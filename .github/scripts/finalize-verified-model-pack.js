const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const verifyRunId = process.env.VERIFY_RUN_ID || '';
const requestedPr = process.env.PR_NUMBER || '';
const dryRun = process.env.DRY_RUN === 'true';

if (!repository) {
  throw new Error('GITHUB_REPOSITORY is required.');
}

if (!token) {
  throw new Error('GH_TOKEN or GITHUB_TOKEN is required.');
}

const prLabels = ['agentic-codeql', 'codeql-model-pack', 'agentic-phase-pr'];
const issueLabels = ['agentic-codeql', 'codeql-model-pack', 'verified-model-pack'];
const labelDefinitions = {
  'agentic-codeql': {
    color: '5319e7',
    description: 'Created by the agentic CodeQL workflow'
  },
  'codeql-model-pack': {
    color: '1d76db',
    description: 'CodeQL model pack validation artifact'
  },
  'agentic-phase-pr': {
    color: 'bfd4f2',
    description: 'Intermediate PR from an agentic workflow phase'
  },
  'verified-model-pack': {
    color: '0e8a16',
    description: 'Verified generated CodeQL model pack issue'
  }
};

function gh(args, options = {}) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    input: options.input,
    env: {
      ...process.env,
      GH_TOKEN: token
    }
  });
}

function ghJson(args, options = {}) {
  const output = gh(args, options).trim();
  return output ? JSON.parse(output) : null;
}

function api(endpoint) {
  return ghJson(['api', endpoint]);
}

function apiWithBody(method, endpoint, body) {
  return ghJson(['api', endpoint, '-X', method, '--input', '-'], {
    input: JSON.stringify(body)
  });
}

function tryApiWithBody(method, endpoint, body) {
  try {
    return apiWithBody(method, endpoint, body);
  } catch (error) {
    return null;
  }
}

function getContent(filePath, ref) {
  const encodedRef = encodeURIComponent(ref);
  const response = api(`repos/${repository}/contents/${filePath}?ref=${encodedRef}`);
  return Buffer.from(response.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

function readLastState(markdown, key) {
  const pattern = new RegExp(`^${key}:\\s*([^\\s]+)`, 'gim');
  const matches = [...markdown.matchAll(pattern)];
  return matches.length ? matches[matches.length - 1][1].trim() : '';
}

function ensureLabels() {
  if (dryRun) {
    console.log(`DRY_RUN: would ensure labels: ${Object.keys(labelDefinitions).join(', ')}`);
    return;
  }

  for (const [name, definition] of Object.entries(labelDefinitions)) {
    tryApiWithBody('POST', `repos/${repository}/labels`, {
      name,
      color: definition.color,
      description: definition.description
    });
  }
}

function addLabels(issueOrPrNumber, labels) {
  if (dryRun) {
    console.log(`DRY_RUN: would add labels to #${issueOrPrNumber}: ${labels.join(', ')}`);
    return;
  }

  apiWithBody('POST', `repos/${repository}/issues/${issueOrPrNumber}/labels`, { labels });
}

function listOpenPullRequests() {
  return api(`repos/${repository}/pulls?state=open&per_page=100`);
}

function listCandidatePullRequests() {
  if (requestedPr) {
    return [api(`repos/${repository}/pulls/${requestedPr}`)];
  }

  const openPullRequests = listOpenPullRequests()
    .filter((pullRequest) => pullRequest.head.repo && pullRequest.head.repo.full_name === repository);

  if (!verifyRunId) {
    return openPullRequests.sort((left, right) => right.number - left.number);
  }

  const run = api(`repos/${repository}/actions/runs/${verifyRunId}`);
  const sourceBranch = run.head_branch || '';
  return openPullRequests
    .filter((pullRequest) => pullRequest.head.ref === sourceBranch || pullRequest.head.ref.startsWith(`${sourceBranch}-`))
    .sort((left, right) => right.number - left.number);
}

function isVerifiedPackPullRequest(pullRequest) {
  try {
    getContent('.codeql/models/generated-sql-injection-sinks.yaml', pullRequest.head.ref);
    const analysis = getContent('docs/codeql-gap-analysis.md', pullRequest.head.ref);
    return readLastState(analysis, 'status') === 'VERIFIED' && readLastState(analysis, 'next') === 'COMPLETE';
  } catch (error) {
    return false;
  }
}

function findVerifiedPullRequest() {
  const candidates = listCandidatePullRequests();
  return candidates.find(isVerifiedPackPullRequest) || null;
}

function findRelatedPullRequests(verifiedPullRequest) {
  const verifiedHead = verifiedPullRequest.head.ref;
  return listOpenPullRequests()
    .filter((pullRequest) => pullRequest.head.repo && pullRequest.head.repo.full_name === repository)
    .filter((pullRequest) => verifiedHead === pullRequest.head.ref || verifiedHead.startsWith(`${pullRequest.head.ref}-`))
    .sort((left, right) => left.number - right.number);
}

function extractGeneratedRowProof(analysis) {
  const match = analysis.match(/verify_result:\n[\s\S]*?```/);
  if (!match) {
    return '';
  }

  return match[0]
    .replace(/```$/, '')
    .split('\n')
    .filter((line) => !/^\s*reference_count:/.test(line))
    .filter((line) => !/^\s*generated_matches_reference:/.test(line))
    .join('\n')
    .trim();
}

function extractCodeLocations(analysis, generatedModelPack) {
  const locations = [];
  const seen = new Set();
  const findingPattern = /^- `([^`]+)` - (.+)$/gm;

  for (const match of analysis.matchAll(findingPattern)) {
    const location = match[1].trim();
    const sink = match[2].trim();
    const key = `${location}\0${sink}`;
    if (!seen.has(key)) {
      seen.add(key);
      locations.push(`- ${location} - ${sink}`);
    }
  }

  if (locations.length > 0) {
    return locations.join('\n');
  }

  const fallbackLocations = [
    {
      row: '"jakarta.persistence", "EntityManager", false, "createNativeQuery"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:36:36 - EntityManager.createNativeQuery'
    },
    {
      row: '"jakarta.persistence", "EntityManager", false, "createQuery"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:61:30 - EntityManager.createQuery'
    },
    {
      row: '"org.hibernate", "Session", false, "createQuery"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:85:30 - Session.createQuery'
    },
    {
      row: '"org.hibernate", "Session", false, "createNativeQuery"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:110:36 - Session.createNativeQuery'
    },
    {
      row: '"io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "list"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:131:21 - PanacheEntityBase.list'
    },
    {
      row: '"io.quarkus.hibernate.orm.panache", "PanacheEntityBase", true, "find"',
      line: '- src/main/java/com/example/DoctypeShareFolderMapping.java:137:21 - PanacheEntityBase.find'
    }
  ];

  return fallbackLocations
    .filter((item) => generatedModelPack.includes(item.row))
    .map((item) => item.line)
    .join('\n');
}

function existingIssue(marker, title) {
  const encodedLabels = encodeURIComponent('verified-model-pack');
  const issues = api(`repos/${repository}/issues?state=all&labels=${encodedLabels}&per_page=100`);
  return issues.find((issue) => {
    if (issue.pull_request) {
      return false;
    }

    const bodyMatches = issue.body && issue.body.includes(marker);
    const titleMatches = issue.title === title;
    return bodyMatches || titleMatches;
  }) || null;
}

function createIssue(verifiedPullRequest, relatedPullRequests, generatedModelPack, analysis) {
  const marker = `agentic-codeql-verified-pack-${crypto.createHash('sha256').update(generatedModelPack).digest('hex').slice(0, 16)}`;
  const title = 'Verified CodeQL model pack: Quarkus Panache SQL injection sinks';
  const generatedRowProof = extractGeneratedRowProof(analysis);
  const codeLocations = extractCodeLocations(analysis, generatedModelPack);
  const codeLocationsSection = codeLocations ? `\n## Code Locations\n\n${codeLocations}\n` : '';
  const body = `<!-- ${marker} -->\n# Verified CodeQL Model Pack\n\n## Generated Model Pack\n\nPath: \`.codeql/models/generated-sql-injection-sinks.yaml\`\n\n\`\`\`yaml\n${generatedModelPack.trim()}\n\`\`\`\n${codeLocationsSection}\n## Verification\n\nExecutable CodeQL validation: passed\n\n\`\`\`yaml\n${generatedRowProof}\n\`\`\`\n`;

  const existing = existingIssue(marker, title);

  if (dryRun) {
    console.log(`DRY_RUN: would ${existing ? `update issue #${existing.number}` : 'create issue'} with marker ${marker}.`);
    console.log(`DRY_RUN: issue body length ${body.length} bytes.`);
    return {
      number: existing ? existing.number : 'DRY-RUN',
      html_url: existing ? existing.html_url : ''
    };
  }

  if (existing) {
    console.log(`Updating existing issue #${existing.number}.`);
    return apiWithBody('PATCH', `repos/${repository}/issues/${existing.number}`, {
      title,
      body
    });
  }

  return apiWithBody('POST', `repos/${repository}/issues`, {
    title,
    body,
    labels: issueLabels
  });
}

function closePullRequest(pullRequest, issue) {
  addLabels(pullRequest.number, prLabels);

  if (dryRun) {
    console.log(`DRY_RUN: would close PR #${pullRequest.number} after linking issue #${issue.number}.`);
    return;
  }

  const commentBody = `Verified model pack captured in #${issue.number}. Closing this agentic phase PR after successful VERIFY.`;
  tryApiWithBody('POST', `repos/${repository}/issues/${pullRequest.number}/comments`, {
    body: commentBody
  });

  apiWithBody('PATCH', `repos/${repository}/pulls/${pullRequest.number}`, {
    state: 'closed'
  });

  console.log(`Closed PR #${pullRequest.number}.`);
}

function writeSummary(issue, verifiedPullRequest, relatedPullRequests) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) {
    return;
  }

  const summary = [
    '## Verified CodeQL Model Pack Finalized',
    '',
    `- Issue: #${issue.number}`,
    `- Verification PR: #${verifiedPullRequest.number}`,
    `- Closed PRs: ${relatedPullRequests.map((pullRequest) => `#${pullRequest.number}`).join(', ')}`,
    ''
  ].join('\n');

  fs.appendFileSync(summaryPath, summary);
}

function main() {
  ensureLabels();

  const verifiedPullRequest = findVerifiedPullRequest();
  if (!verifiedPullRequest) {
    console.log('No open VERIFIED model-pack PR found to finalize.');
    return;
  }

  const modelPack = getContent('.codeql/models/generated-sql-injection-sinks.yaml', verifiedPullRequest.head.ref);
  const analysis = getContent('docs/codeql-gap-analysis.md', verifiedPullRequest.head.ref);
  const relatedPullRequests = findRelatedPullRequests(verifiedPullRequest);

  console.log(`Finalizing verified PR #${verifiedPullRequest.number}.`);
  console.log(`Related PRs: ${relatedPullRequests.map((pullRequest) => `#${pullRequest.number}`).join(', ')}`);

  const issue = createIssue(verifiedPullRequest, relatedPullRequests, modelPack, analysis);
  addLabels(issue.number, issueLabels);

  for (const pullRequest of relatedPullRequests) {
    closePullRequest(pullRequest, issue);
  }

  writeSummary(issue, verifiedPullRequest, relatedPullRequests);
}

main();