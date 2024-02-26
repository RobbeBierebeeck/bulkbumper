#! /usr/bin/env node
import {program} from 'commander';
import fs from 'fs';

import packageJson from './package.json' assert {type: 'json'};
import {exec} from 'child_process';

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
    exec('npm install',{
        cwd: directory
    },(err, stdout, stderr) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log(stdout);
    });
}

const updatePackage = async (file, filePath, options) => {
    const packageJson = await fs.promises.readFile(file, 'utf-8');
    const json = JSON.parse(packageJson);
    json.dependencies[options.package] = options.release;
    await fs.promises.writeFile(filePath, JSON.stringify(json, null, 2));
}

const loopAndBump = async (directory, maxDepth, options, depth = 0) => {
    const files = await fs.promises.readdir(directory);
    for (const file of files) {
        const filePath = `${directory}/${file}`;
        const stats = await fs.promises.stat(filePath);

        if (stats.isDirectory()) {
            if (depth < maxDepth) {
                await loopAndBump(filePath, maxDepth, depth + 1);
            }
        } else if (stats.isFile()) {
            if (file === 'package.json') {
                await updatePackage(file, filePath, options);
                installDependencies(directory);
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

})();

