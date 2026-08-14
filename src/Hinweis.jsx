import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Info } from "lucide-react";

/* Kurze Einblendung am unteren Rand.

   Zweck: Ein Knopf, der beim Antippen nichts tut, wirkt kaputt — beim
   Vorführen ist das schlimmer als ein fehlender Knopf. Was noch nicht
   verdrahtet ist, sagt das jetzt selbst. */

const Zusammenhang = createContext(() => {});

export function HinweisRahmen({ children }) {
  const [text, setText] = useState(null);
  const uhr = useRef(null);

  const zeige = useCallback((t) => {
    setText(t);
    clearTimeout(uhr.current);
    uhr.current = setTimeout(() => setText(null), 2600);
  }, []);

  useEffect(() => () => clearTimeout(uhr.current), []);

  return (
    <Zusammenhang.Provider value={zeige}>
      {children}
      {text && (
        <div className="wr-toast" role="status">
          <Info size={15} />
          <span>{text}</span>
        </div>
      )}
    </Zusammenhang.Provider>
  );
}

/* zeige("Text") für eine beliebige Meldung. */
export const useHinweis = () => useContext(Zusammenhang);

/* Für Funktionen, die es noch nicht gibt. Eine Formulierung für alle,
   damit klar ist: nicht kaputt, sondern noch nicht gebaut. */
export function useBald() {
  const zeige = useHinweis();
  return useCallback((was) => zeige(`${was} ist noch nicht verdrahtet.`), [zeige]);
}
