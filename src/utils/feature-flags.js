// TODO: enable/disable feature flags in the DB and consume them via API. 
// This is a temporary FE only implementation. 


export function isEnabledForTestOrgs(orgId) {
    const isPennsieveTestDev =
    orgId ===
    "N:organization:050fae39-4412-43ef-a514-703ed8e299d5";

  const isPennsieveTestProd =
    orgId ===
    "N:organization:400e5ec8-56b3-4e31-8932-738a7ea6d385";
  return isPennsieveTestDev || isPennsieveTestProd;
}

export function isEnabledForImmuneHealth(orgId) {
    const isImmuneHealthProd =
    orgId ===
    "N:organization:aab5058e-25a4-43f9-bdb1-18396b6920f2";
   return isImmuneHealthProd;
}

export function isEnabledForAllDevOrgs(url) {
  return url === 'https://api.pennsieve.net'
}