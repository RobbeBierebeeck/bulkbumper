#! /usr/bin/env node
import {program} from 'commander';
import fs from 'fs';
import {exec} from 'child_process';

import packageJson from '../package.json' assert {type: 'json'};

const defineOptions = () => {
    program
        .name(packageJson.name)
        .version(packageJson.version)
        .description(packageJson.description)

    program
        .option('-dir, --directory <directory>', 'Directory to be used', '.')
        .option('-d, --depth <depth>', 'How deeply nested the package can look for package.json files', 0)
        .requiredOption('-p, --package <package>', 'Package to be used')
        .requiredOption('-rel, --release <release>', 'Version to be used');

    program.parse();

    return program.opts();
}

const installDependencies = (directory) => {
    exec('npm install', {
        cwd: directory
    }, (err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}

const updatePackageIfExist =  (json, packageName, newVersion) => {
    if (json.dependencies && json.dependencies.hasOwnProperty(packageName)) {
        json.dependencies[packageName] = newVersion;
        return true;
    }
    return false;
}

const updatePackage = async (file, filePath, options) => {
    let updated = false;
    const packageJson = await fs.promises.readFile(filePath, 'utf-8');
    const json = JSON.parse(packageJson);

    if (updatePackageIfExist(json, options.package, options.release)) {
        await fs.promises.writeFile(filePath, JSON.stringify(json, null, 4));
        updated = true;
    }

    return updated;
}

const loopAndBump = async (directory, maxDepth, options, depth = 0) => {
    const files = await fs.promises.readdir(directory);
    for (const file of files) {
        const filePath = `${directory}/${file}`;
        const stats = await fs.promises.stat(filePath);

        if (file === 'node_modules' || file === 'dist' || file === 'build' || file === 'coverage') {
            continue;
        }

        if (stats.isDirectory()) {
            if (depth < maxDepth) {
                await loopAndBump(filePath, maxDepth, options, depth + 1);
            }
        } else if (stats.isFile()) {
            if (file === 'package.json') {
               const updated =  await updatePackage(file, filePath, options)
                if (updated) {
                    installDependencies(directory);
                }
            }
        }
    }

}

(async () => {
    const options = defineOptions();
    await loopAndBump(options.directory, Number(options.depth), options);

    console.log({
        directory: options.directory,
        package: options.package,
        release: options.release,
        depth: +options.depth
    });

    process.exit(0);
})();

