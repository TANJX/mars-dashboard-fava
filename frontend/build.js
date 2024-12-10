const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function build() {
    try {
        // Run CRA build
        console.log('Building React app...');
        execSync('npm run build', { stdio: 'inherit' });

        // Read the main bundle file from the build output
        const buildPath = path.resolve(__dirname, 'build/static/js');
        const files = fs.readdirSync(buildPath);
        const mainBundle = files.find(f => f.match(/^main\..*\.js$/));
        
        if (!mainBundle) {
            throw new Error('Could not find main bundle in build output');
        }

        const bundleContent = fs.readFileSync(path.join(buildPath, mainBundle), 'utf8');

        // Read the CSS file
        const cssPath = path.resolve(__dirname, 'build/static/css');
        const cssFiles = fs.readdirSync(cssPath);
        const mainCss = cssFiles.find(f => f.match(/^main\..*\.css$/));

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
        // Only add script if it hasn't been added before
        // if (!document.querySelector('script[data-mars-dashboard]')) {
            const script = document.createElement('script');
            script.setAttribute('data-mars-dashboard', 'true');
            script.textContent = ${JSON.stringify(bundleContent)};
            document.body.appendChild(script);
        // }
    },
};`;

        // Write to MarsDashboard.js
        const dashboardPath = path.resolve(__dirname, '../src/mars_dashboard/MarsDashboard.js');
        fs.writeFileSync(dashboardPath, dashboardContent);

        // Write to style.css
        const stylePath = path.resolve(__dirname, '../src/mars_dashboard/templates/style.css');
        fs.writeFileSync(stylePath, cssContent);

        console.log('Build completed and files injected into extension');
    } catch (error) {
        console.error('Build failed:', error);
        process.exit(1);
    }
}

build();