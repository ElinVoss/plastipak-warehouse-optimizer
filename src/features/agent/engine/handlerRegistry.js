import { handleHelp } from "./handlers/help";
import { handleBinInfo } from "./handlers/binInfo";
import { handlePutaway } from "./handlers/putaway";
import { handleCapacityQuery } from "./handlers/capacityQuery";
import { handleMaterialLookup } from "./handlers/materialLookup";
import { handleRuleExplanation } from "./handlers/ruleExplanation";
import { handleTunnelPair } from "./handlers/tunnelPair";
import { handleRowInfo } from "./handlers/rowInfo";
import { handleSideBin } from "./handlers/sideBin";
import { handleWarehouseScope } from "./handlers/warehouseScope";
import { handleMoveExplanation } from "./handlers/moveExplanation";

const HANDLERS = {
  help: handleHelp,
  binInfo: handleBinInfo,
  putaway: handlePutaway,
  capacityQuery: handleCapacityQuery,
  materialLookup: handleMaterialLookup,
  ruleExplanation: handleRuleExplanation,
  tunnelPair: handleTunnelPair,
  rowInfo: handleRowInfo,
  sideBin: handleSideBin,
  warehouseScope: handleWarehouseScope,
  moveExplanation: handleMoveExplanation,
};

export function dispatch(intent, context) {
  const handler = HANDLERS[intent] || HANDLERS.help;
  try {
    return handler(context);
  } catch (err) {
    return {
      type: "error",
      text: `Something went wrong processing that request. (${err.message || "Unknown error"})`,
    };
  }
}
