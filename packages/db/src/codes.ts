// Access codes are generated, never chosen: two German nouns kids know and two digits (`TIGER-APFEL-48`), about
// 4 million codes. Stored lowercase; kids may type them in any case, with spaces instead of dashes.
import { randomInt } from 'node:crypto';

/** checked by hand: known to 10-year-olds, no umlauts, nothing a kid could use as an insult */
export const CODE_WORDS: readonly string[] = `
ADLER AMSEL BIBER BIENE DACHS DELFIN DRACHE ELCH ENTE EULE FALKE FISCH
FROSCH FUCHS GANS GECKO GIRAFFE HAI HAMSTER HASE HIRSCH HUHN HUMMEL HUND
IGEL KAMEL KATZE KOALA KRABBE KRAKE KUH LACHS LAMA LUCHS MARDER MAUS
MEISE OTTER PANDA PFERD PINGUIN PONY QUALLE RABE RAUPE ROBBE SCHAF SCHWAN
SPATZ STORCH TAUBE TIGER WAL WIESEL WOLF ZEBRA ZIEGE APFEL BANANE BIRNE
BOHNE BREZEL BROT BUTTER DATTEL ERBSE FEIGE GURKE HONIG KAKAO KAROTTE KEKS
KIRSCHE KIWI KUCHEN MAIS MANGO MELONE MILCH MUFFIN NUDEL NUSS OLIVE ORANGE
PAPRIKA PFLAUME PIZZA POPCORN REIS SALAT SUPPE TOMATE TORTE TRAUBE WAFFEL ZITRONE
BAUM BERG BLATT BLITZ BLUME EICHEL FEDER FLUSS INSEL KAKTUS KOMET MEER
MOND MOOS MUSCHEL NEBEL OASE PALME PILZ PLANET QUELLE REGEN ROSE SCHNEE
SONNE STEIN STERN STRAND TAL TULPE VULKAN WALD WELLE WIESE WIND WOLKE
ANKER AUTO BALL BALLON BOOT BRIEF BUCH BURG BUS DOMINO EIMER FARBE
FLASCHE GABEL GARTEN GEIGE GITARRE GLOCKE HAMMER HARFE HAUS HEFT HUT IGLU
JACKE KAMERA KARTE KEGEL KERZE KISTE KOFFER KOMPASS KORB KREIDE KREISEL KRONE
LAMPE LEITER LINEAL LUPE MAGNET MURMEL PAKET PERLE PIANO PINSEL PIXEL PUZZLE
RADIO RAKETE RITTER ROBOTER ROLLER SCHAL SCHATZ SCHERE SCHIFF SCHIRM SCHUH SEGEL
SPIEGEL STIFT STUHL TASSE TELLER TISCH TOPF TRAKTOR TROMMEL TURM UHR ZANGE
ZAUN ZELT ZIRKUS ZUG ZWERG RIESE
`
  .trim()
  .split(/\s+/);

/** a fresh code, lowercase like it is stored */
export const generateCode = (): string => {
  const first = randomInt(CODE_WORDS.length);
  // the second word differs from the first: TIGER-TIGER looks like a typo
  const second = (first + 1 + randomInt(CODE_WORDS.length - 1)) % CODE_WORDS.length;
  const digits = String(randomInt(100)).padStart(2, '0');
  return `${CODE_WORDS[first]}-${CODE_WORDS[second]}-${digits}`.toLowerCase();
};

/** what a kid or an adult typed, as it is stored: case and spaces around don't matter, a space works as a dash */
export const normalizeCode = (typed: string): string => typed.trim().toLowerCase().replace(/\s+/g, '-');

/** how a code is shown */
export const displayCode = (code: string): string => code.toUpperCase();
