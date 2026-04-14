const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

function findMp4File(directory) {
    return new Promise((resolve, reject) => {
        fs.readdir(directory, { withFileTypes: true }, (err, files) => {
            if (err) {
                return reject(err);
            }

            for (const file of files) {
                const filePath = path.join(directory, file.name);
                if (file.isDirectory()) {
                    findMp4File(filePath)
                        .then(mp4Path => resolve(mp4Path))
                        .catch(() => {});
                } else if (path.extname(file.name).toLowerCase() === '.mp4') {
                    return resolve(filePath);
                }
            }

            reject(new Error('No MP4 file found'));
        });
    });
}

function convertMp4ToMov(mp4Path, movPath) {
    return new Promise((resolve, reject) => {
        const command = `ffmpeg -i "${mp4Path}" -c:v prores_ks -profile:v 3 -pix_fmt yuva444p10le -vf scale=1920:1080 "${movPath}"`;
        exec(command, (err, stdout, stderr) => {
            if (err) {
                return reject(err);
            }
            resolve(movPath);
        });
    });
}

async function main() {
    const directory = './'; // Start searching from the current directory
    try {
        const mp4Path = await findMp4File(directory);
        console.log(`Found MP4 file: ${mp4Path}`);

        const movPath = path.join(path.dirname(mp4Path), `${path.basename(mp4Path, '.mp4')}.mov`);
        console.log(`Converting to MOV file: ${movPath}`);

        await convertMp4ToMov(mp4Path, movPath);
        console.log('Conversion completed successfully');
    } catch (err) {
        console.error('Error:', err.message);
    }
}

main();
