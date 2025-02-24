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
 

   const isSPARCProd = 
   orgId === "N:organization:618e8dd9-f8d2-4dc4-9abb-c6aaab2e78a0";

   const isStandardBiotools = orgId === "N:organization:09bf8aa4-ea99-4816-9c83-15cbc785ba8e";

   const isBMIN5100 = orgId === "N:organization:c153f6a1-8ba1-4eeb-9459-2ccd50f721af";

   const isSEED = orgId === "N:organization:301af08c-3302-4f89-82fe-d7f66608545f";

   const isPedQuest = orgId === "N:organization:42b5c50f-48e3-4c7e-b107-cedaf12b7271";

   const isEpilepsyScience = orgId === "N:organization:f921dd34-f0f3-417a-bbe6-23f71020146f";

   return isImmuneHealthProd || isCNTProd || isHackathonProd || isSPARCProd || isStandardBiotools || isBMIN5100 || isSEED || isPedQuest || isEpilepsyScience;
}

export function isEnabledForAllDevOrgs(url) {
  return url === 'https://api.pennsieve.net'
}