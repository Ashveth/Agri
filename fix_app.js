import fs from 'fs';

const filePath = 'src/App.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix duplication at line 312-318 (approx)
// We look for the pattern of LANGUAGES followed by another LANGUAGES
const languagesFix = content.replace(
  /\] as const;\s+type AppLanguage = typeof LANGUAGES\[number\]\['id'\];\s+const UI_TRANSLATIONS: Record<AppLanguage, Record<string, string>> = \{\s+\{ id: 'Punjabi', name: '.*?' \},\s+\] as const;\s+type AppLanguage = typeof LANGUAGES\[number\]\['id'\];\s+const UI_TRANSLATIONS: Record<AppLanguage, Record<string, string>> = \{/s,
  '] as const;\n\ntype AppLanguage = typeof LANGUAGES[number][\'id\'];\n\nconst UI_TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {'
);

// Fix corruption block starting with /* DELETE_CORRUPTION */
const finalFix = languagesFix.replace(
  /\/\* DELETE_CORRUPTION \*\/.*?\nconst Navbar/s,
  'const Navbar'
);

fs.writeFileSync(filePath, finalFix);
console.log('File fixed successfully');
