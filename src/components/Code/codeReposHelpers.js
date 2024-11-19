export function testFunction (param) {
    if (param) {
    return 'banana'
    } return 'yo'

}

export const hasRelease = (codeRepo) => {
    /*
      hasRelease condition is met when the repo has the following:
      1. The "releases" property has a value that is an array
      2. The first element in the array (the latest release) has a releaseStatus that is not "never"
      3. Has values in label and marker properties
    */
    if (codeRepo) {
      const release = codeRepo?.content?.releases?.[0];
      return (
        release?.releaseStatus !== "never" && (release?.label?.length ?? 0) > 0
        // && (release?.marker?.length ?? 0) > 0
      );
    }
    return false;
};
  
export const hasLicense = (codeRepo) => {
    const license = codeRepo?.content?.license;
    return !!license?.length;
  };
  
export const hasReadMe = (readMe) => {
    return readMe;
  };

