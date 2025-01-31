// TODO: enable/disable feature flags in the DB and consume them via API. 
// This is a temporary FE only implementation. 


export function isEnabledForTestOrgs(orgId) {
    const isPennsieveTestDev =
    orgId ===
    "N:organization:050fae39-4412-43ef-a514-703ed8e299d5";

  const isPennsieveTestProd =
    orgId ===
    "N:organization:760ee96c-9777-46e3-83eb-3099a7e16baa";
  return isPennsieveTestDev || isPennsieveTestProd;
}

export function isEnabledForSpecificOrgs(orgId) {
    const isImmuneHealthProd =
    orgId ===
    "N:organization:aab5058e-25a4-43f9-bdb1-18396b6920f2";

    const isCNTProd = 
    orgId ===
    "N:organization:fecf73c8-b590-47fa-8de0-74cfb57051a2"

    const isHackathonProd = 
    orgId === "N:organization:388563ac-49b5-4fc1-b6b0-2fba767e54b0";
   return isImmuneHealthProd || isCNTProd || isHackathonProd;
}

export function isEnabledForAllDevOrgs(url) {
  return url === 'https://api.pennsieve.net'
}