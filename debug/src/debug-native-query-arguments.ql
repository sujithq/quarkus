/**
 * @name Debug native query SQL arguments
 * @description Lists SQL argument expressions passed to createNativeQuery so Argument[0] modeling can be checked.
 * @kind table
 * @id local/debug-native-query-arguments
 */

import java

from MethodCall call, Expr sqlArgument
where
  call.getMethod().getName() = "createNativeQuery" and
  sqlArgument = call.getArgument(0)
select sqlArgument, call, "SQL argument passed as Argument[0] to " + call.getMethod().getQualifiedName()