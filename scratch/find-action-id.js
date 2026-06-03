import fs from 'fs';

const content = fs.readFileSync('scratch/js-0jhrnbd8.zcis.js', 'utf8');

// The function signature was:
// e.s(["LoginForm",0,function({lastProvider:e,enableSsoLogin:l,redirectTo:c}){...}])
// Let's find the function declaration that encloses "LoginForm"
const index = content.indexOf('LoginForm');
if (index !== -1) {
  // Let's look slightly before "LoginForm" to see what parameters the enclosing module or function takes.
  // The variables d and u must be imported or defined in the module.
  const start = Math.max(0, index - 2000);
  console.log(content.substring(start, index));
} else {
  console.log('LoginForm not found');
}
