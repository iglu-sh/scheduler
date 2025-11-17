{ buildBunApplication }:

buildBunApplication {
  src = ../../..;

  nodeModuleHash = "sha256-Ru6Nv3hq6V2CN2rXzDdy9O1/CvApINVL3j8WUun3iY8=";

  bunScript = "start";

  filesToInstall = [
    "index.ts"
    "types"
    "lib"
    "tsconfig.json"
  ];
}
