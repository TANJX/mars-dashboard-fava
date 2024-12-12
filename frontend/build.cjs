const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function build() {
    try {
        // Run CRA build
        console.log('Building Vite app...');
        execSync('yarn build', { stdio: 'inherit' });

        // Read the main bundle file from the build output
        const buildPath = path.resolve(__dirname, 'dist/assets');
        const files = fs.readdirSync(buildPath);
        console.log(buildPath)
        const mainBundle = files.find(f => f.match(/^index.*\.js$/));
        
        if (!mainBundle) {
            throw new Error('Could not find main bundle in build output');
        }

        const bundleContent = fs.readFileSync(path.join(buildPath, mainBundle), 'utf8');

        // Read the CSS file
        const cssPath = path.resolve(__dirname, 'dist/assets');
        const cssFiles = fs.readdirSync(cssPath);
        const mainCss = cssFiles.find(f => f.match(/^index.*\.css$/));

        if (!mainCss) {
            throw new Error('Could not find main CSS in build output');
        }

        const cssContent = fs.readFileSync(path.join(cssPath, mainCss), 'utf8');

        // Create the MarsDashboard.js content
        const dashboardContent = `export default {
    init() {
    },
    onPageLoad() {
    },
    onExtensionPageLoad() {
        const existingScript = document.querySelector('script[data-mars-dashboard]');
        if (existingScript) {
            existingScript.remove();
        }
        const script = document.createElement('script');
        script.setAttribute('data-mars-dashboard', 'true');
        script.textContent = ${JSON.stringify(bundleContent)};
        document.body.appendChild(script);
    },
};`;

        // Write to MarsDashboard.js
        const dashboardPath = path.resolve(__dirname, '../src/mars_dashboard/MarsDashboard.js');
        console.log('Writing to MarsDashboard.js:', dashboardPath);
        fs.writeFileSync(dashboardPath, dashboardContent);

        // Write to style.css
        const stylePath = path.resolve(__dirname, '../src/mars_dashboard/templates/style.css');
        console.log('Writing to style.css:', stylePath);
        fs.writeFileSync(stylePath, cssContent);

        console.log('Build completed and files injected into extension');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();