import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenConsolidatorModule", (m) => {
  const initialOwner = m.getParameter("initialOwner");
  const treasury = m.getParameter("treasury");

  const tokenConsolidator = m.contract("TokenConsolidator", [
    initialOwner,
    treasury,
  ]);

  return { tokenConsolidator };
});
