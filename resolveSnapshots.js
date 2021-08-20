const path = require("path");

module.exports = {
  // resolves from test to snapshot path
  resolveSnapshotPath: (testPath, snapshotExtension) => {
    return (
      testPath.replace("lib-commonjs", "__snapshots__") + snapshotExtension
    );
  },

  // resolves from snapshot to test path
  resolveTestPath: (snapshotFilePath, snapshotExtension) => {
    const testPath = snapshotFilePath
      .replace(snapshotExtension, "")
      .replace("__snapshots__/", "lib-commonjs"); //Remove the .snap
    return testPath;
  },

  // Example test path, used for preflight consistency check of the implementation above
  testPathForConsistencyCheck: "example.test.js",
};
