export const stepDocumentMap = {
  "KYC & Background Check": ["passportCopy", "passportPhoto", "proofOfAddress"],
  "Office Space Leasing": ["signedLeaseAgreement"],
  "Trade License Creation": ["tradeLicenseCopy"],
  "Establishment Card & Visa Allocation": ["passportCopy", "tradeLicenseCopy"],
  "Visa Application": [], // ⬅️ Handled through visa substeps
  "Tax Registration": ["vatCertificate", "corporateTaxCertificate"],
  "Banking Setup": ["bankAccountProof"],
};
