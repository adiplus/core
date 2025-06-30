import fs from "fs-extra";
import fetch from "node-fetch";
import unzipper from "unzipper";
import path from "path";

export async function installPackage(pkg) {
  const [owner, repo] = pkg.split("/");
  const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/main.zip`;
  const tempZip = "./temp.zip";

  try {
    console.log(`🔽 Downloading ${pkg}...`);
    const res = await fetch(zipUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch: ${res.status} ${res.statusText}`);
    }
    const buffer = await res.arrayBuffer();
    fs.writeFileSync(tempZip, Buffer.from(buffer));

    console.log(`📦 Extracting...`);
    await fs.createReadStream(tempZip)
      .pipe(unzipper.Extract({ path: `./packages` }))
      .promise();

    fs.unlinkSync(tempZip);

    // Find the extracted folder (repo-branch)
    const extractedDir = fs.readdirSync("./packages")
      .find(d => d.startsWith(repo + "-"));
    if (!extractedDir) {
      throw new Error("Extraction failed: folder not found.");
    }
    const extractedPath = path.join("./packages", extractedDir);
    const finalPath = `./packages/${repo}`;
    if (fs.existsSync(finalPath)) fs.removeSync(finalPath);
    fs.renameSync(extractedPath, finalPath);

    // Check for entry points
    const hasAdi = fs.existsSync(path.join(finalPath, "index.adi"));
    const hasJs = fs.existsSync(path.join(finalPath, "index.js"));
    if (!hasAdi && !hasJs) {
      console.warn(`⚠️ Package '${repo}' has no index.adi or index.js entry point.`);
    }

    console.log(`✅ Installed to packages/${repo}`);
  } catch (err) {
    console.error(`❌ Failed to install package: ${err.message}`);
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
  }
}