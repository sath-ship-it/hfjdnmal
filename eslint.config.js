import reactHooks from "eslint-plugin-react-hooks";

/* Prüfung, die ein Bildschirmtest nicht leisten kann.

   Anlass: Drei Hooks standen hinter den frühen Rückgaben von App().
   Auf dem Anmeldebildschirm laufen sie nicht, danach schon — React
   zählt Hooks und bricht ab, sobald die Zahl sich zwischen zwei
   Durchgängen ändert. Das Ergebnis war ein schwarzer Bildschirm, und
   zwar erst NACH der Anmeldung. Der Rauchtest kommt aber nie über den
   Anmeldebildschirm hinaus und blieb grün.

   Genau diese Sorte Fehler sieht man dem Code an, nicht dem Bild.
   Deshalb hier statt noch eines Browsertests.

   Bewusst schmal gehalten: nur die Hook-Regeln, kein Stilkatalog. Ein
   Prüfer, der bei jedem Lauf hundert Belanglosigkeiten meldet, wird
   nach einer Woche nicht mehr gelesen. */
export default [
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { __FASSUNG__: "readonly" },
    },
    rules: {
      /* Der Fehler von oben. Nicht verhandelbar. */
      "react-hooks/rules-of-hooks": "error",
      /* Fehlende Abhängigkeiten sind oft Absicht, manchmal ein Fehler —
         als Warnung sichtbar, ohne den Bau anzuhalten. */
      "react-hooks/exhaustive-deps": "warn",
    },
  },
];
