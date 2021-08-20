import path from "path";
import glob from "glob";
import transformTypedImports, {
  TransformTypedImportsResult,
} from "./transformTypedImports";

const projectPath = path.join(__dirname, "../tests");
const testFiles = glob
  .sync("src/**/*.ts", { cwd: projectPath })
  .map((f) => path.resolve(projectPath, f));

describe("transformTypedImports", () => {
  let testResults: TransformTypedImportsResult;

  beforeAll(async () => {
    testResults = await transformTypedImports({
      projectPath,
      dry: true,
      silent: true,
    });
  });

  for (const filePath of testFiles) {
    const fileName = path.basename(filePath);

    it(`produces expected output for ${fileName}`, () => {
      const changeEntry = testResults.updates.find((u) => {
        return path.resolve(u.path) === filePath;
      });
      if (changeEntry) {
        expect(changeEntry.originalContent).toMatchSnapshot("originalContent");
        expect(changeEntry.newContent).toMatchSnapshot("newContent");
      }
    });
  }
});
