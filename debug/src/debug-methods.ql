/**
 * @name Debug query API method calls
 * @description Lists query-construction calls and their declaring types so model tuples can be verified.
 * @kind table
 * @id local/debug-query-api-method-calls
 */

import java

from MethodCall call
where call.getMethod().getName() in ["createNativeQuery", "createQuery", "find", "list", "stream"]
select call, call.getMethod().getDeclaringType(), "Query API call: " + call.getMethod().getQualifiedName()