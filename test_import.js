require('ts-node').register();
const { generateProject } = require('./src/inngest/functions/generateProject.ts');
console.log(generateProject.name);
