// The terms of use (Nutzungsbedingungen), German. Derived from docs/platform-plan.md; one document with
// marked sections per role, so there is one version to track. A changed text needs a new TERMS_VERSION
// (lib/terms.ts): accounts store the version they accepted. A starting point for Rainer's lawyer, not
// legal advice; the reasons behind some wordings (Austrian consumer law) are in docs/legal-texts.md.
import { TextLink } from '../components/ui/text-link.tsx';
import { CONTACT_EMAIL, SOURCE_URL } from '../lib/site.ts';

export const terms = {
  title: 'Nutzungsbedingungen',
  date: 'Stand: 31. Oktober 2026',
  keyPointsTitle: 'Das Wichtigste in Kürze',
  keyPoints: [
    'AI-Scratch ist ein kostenloses Lernspiel. Wir verdienen damit kein Geld.',
    'Wer einen eigenen OpenRouter-Schlüssel verwendet, bezahlt die KI direkt bei OpenRouter, nicht an uns.',
    'Wir geben keine Gewähr: AI-Scratch kann ausfallen, Fehler haben, sich ändern oder eingestellt werden.',
    'Kinder nutzen AI-Scratch anonym und nur unter Aufsicht eines Erwachsenen. Die Erwachsenen erklären ihnen, dass sie keine persönlichen oder sensiblen Daten eingeben.',
    'Die Daten der registrierten Erwachsenen speichern und verarbeiten wir in der EU. KI-Dienste können auch außerhalb der EU arbeiten, insbesondere in den USA.',
    'Wir können Unterhaltungen und Spiele von Kindern speichern, um AI-Scratch zu verbessern und abzusichern und um darüber zu forschen. Wir verkaufen sie nie und veröffentlichen nichts, das Rückschlüsse auf einzelne Personen erlaubt.',
    'Scratch ist ein eigenständiges Produkt der Scratch Foundation. AI-Scratch verwendet den Scratch-Editor als Baustein, ist aber kein Angebot der Scratch Foundation oder des MIT und wird von ihnen in keiner Weise unterstützt oder empfohlen.',
    'Der Quellcode ist offen: Jede und jeder kann nachprüfen, wie AI-Scratch funktioniert.',
  ],
} as const;

const Mail = () => <TextLink href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</TextLink>;

/** The full text; place it inside Prose. */
export function TermsDocument() {
  return (
    <>
      <h2 id="worum-es-geht">1. Worum es geht</h2>
      <p>
        AI-Scratch ist ein Lernspiel für Kinder von etwa 10 bis 14 Jahren: der unveränderte Scratch-Editor mit einem
        KI-Helfer daneben, der Kindern auf Deutsch hilft, eigene Spiele zu programmieren. Die Kinder lernen dabei
        programmieren und mit einer KI zu arbeiten. Das Lernspiel läuft unter ai-scratch.dev; Lehrkräfte und andere
        Erwachsene verwalten die Zugänge im Office unter office.ai-scratch.dev.
      </p>
      <p>
        AI-Scratch ist eine private, nicht kommerzielle Initiative von Rainer Stropek, der den Dienst betreibt („wir“).
        Kontakt: <Mail />
      </p>
      <p>
        Diese Bedingungen gelten für alle Erwachsenen, die sich im Office registrieren („Sie“), und für die Nutzung von
        AI-Scratch mit den Zugangscodes, die sie erstellen. Mit der Registrierung schließen Sie mit uns einen
        unentgeltlichen Nutzungsvertrag zu diesen Bedingungen. Was nur für Lehrkräfte oder nur für Eltern und andere
        Erwachsene gilt, ist so gekennzeichnet.
      </p>

      <h2 id="kostenlos">2. Kostenlos und ohne Gewinn</h2>
      <ul>
        <li>
          Die Nutzung von AI-Scratch ist kostenlos. Wir verlangen kein Entgelt, zeigen keine Werbung und verkaufen keine
          Daten. <strong>Wir verdienen mit AI-Scratch kein Geld.</strong>
        </li>
        <li>
          Die KI-Kosten der Zugangscodes von Lehrkräften tragen gespendete Guthaben bei KI-Anbietern, von Rainer Stropek
          und von Unterstützerinnen und Unterstützern. Dieses Gratis-Budget ist begrenzt; einen Anspruch darauf gibt es
          nicht.
        </li>
        <li>
          Rainer Stropek ist Microsoft Most Valuable Professional (MVP). Als MVP erhält er von Microsoft kostenlose
          Azure-Ressourcen. Einen Teil davon verwendet er für die Server von AI-Scratch in Microsoft Azure. AI-Scratch
          ist trotzdem kein Angebot von Microsoft.
        </li>
        <li>
          Wer einen eigenen OpenRouter-Schlüssel verwendet, <strong>bezahlt die KI-Nutzung direkt an OpenRouter</strong>
          . An uns fließt dabei kein Geld, auch keine Provision.
        </li>
      </ul>

      <h2 id="quellcode">3. Offener Quellcode</h2>
      <p>
        Der gesamte Quellcode von AI-Scratch ist Open Source (Lizenz AGPL-3.0) und öffentlich:{' '}
        <TextLink href={SOURCE_URL}>github.com/rstropek/ai-scratch</TextLink>. Jede und jeder kann dort nachprüfen, wie
        AI-Scratch funktioniert: welche Daten es verarbeitet, wohin es sie schickt und wie es Kinder schützt. Der Dienst
        wird aus diesem Code gebaut. Teile davon stammen von anderen, etwa der Scratch-Editor; für sie gelten ihre
        eigenen Lizenzen.
      </p>

      <h2 id="registrierung">4. Registrierung</h2>
      <ul>
        <li>
          <strong>Registrieren können sich nur Erwachsene</strong> (ab 18 Jahren). Kinder brauchen und bekommen kein
          Konto.
        </li>
        <li>
          Sie registrieren sich als Lehrkraft oder als Elternteil oder anderer Erwachsener (zum Beispiel für einen
          CoderDojo oder eine Jugendgruppe).
        </li>
        <li>
          Ihre Angaben müssen wahr sein. Ihr Konto ist persönlich: Geben Sie Ihr Passwort nicht weiter, und melden Sie
          sich auf Geräten, die auch andere benutzen, nach der Arbeit ab.
        </li>
        <li>
          <strong>Nur für Lehrkräfte:</strong> Für das Gratis-Budget bewerben Sie sich mit Angaben zu Ihrer Schule und
          dazu, wofür Sie AI-Scratch nutzen möchten. Eine KI prüft diese Angaben automatisch auf offensichtlich
          ungültige oder missbräuchliche Bewerbungen; wir können sie auch selbst prüfen. Einen Anspruch auf Annahme gibt
          es nicht. Wird Ihre Bewerbung nicht angenommen, können Sie AI-Scratch wie Eltern mit einem eigenen
          OpenRouter-Schlüssel nutzen.
        </li>
      </ul>

      <h2 id="zugangscodes">5. Zugangscodes</h2>
      <p>Kinder kommen nur mit einem Zugangscode in den KI-Helfer, den ein registrierter Erwachsener erstellt hat.</p>
      <ul>
        <li>
          Ein Code gilt nur in einem kurzen Zeitfenster (derzeit höchstens 4 Stunden) und hat ein eigenes Kostenlimit.
        </li>
        <li>
          Geben Sie Codes nur an Kinder weiter, deren Nutzung Sie beaufsichtigen (
          <TextLink href="#aufsicht">Abschnitt 7</TextLink>), und veröffentlichen Sie sie nicht, zum Beispiel im
          Internet.
        </li>
        <li>In den Kommentar zu einem Code gehören keine Namen von Kindern.</li>
        <li>
          Mit dem Block „frage KI“ stellen Kinder aus ihrem eigenen Programm Fragen an eine KI. Sie können ihn für jeden
          Code ausschalten.
        </li>
        <li>
          <strong>Nur für Lehrkräfte:</strong> Codes aus dem Gratis-Budget haben Grenzen pro Monat: für die Zahl der
          Codes, für die Kosten pro Lehrkraft und für die Kosten insgesamt. Wir legen diese Grenzen fest und können sie
          jederzeit ändern. Ist ein Budget aufgebraucht, hört der KI-Helfer auf zu antworten, auch mitten in einer
          Unterrichtsstunde. Scratch selbst funktioniert weiter.
        </li>
      </ul>

      <h2 id="openrouter">6. Eigene OpenRouter-Schlüssel</h2>
      <ul>
        <li>
          Statt des Gratis-Budgets können Sie Codes mit einem eigenen API-Schlüssel von OpenRouter (openrouter.ai)
          betreiben. <strong>Alle Kosten tragen Sie</strong>; sie werden direkt von Ihrem Guthaben bei OpenRouter
          abgebucht. Wir erstatten keine Kosten.
        </li>
        <li>
          Ihr Schlüssel braucht bei OpenRouter ein Ausgabelimit. Wenn Sie einen Code erstellen, prüfen wir, dass über
          den Schlüssel höchstens noch 25 US-Dollar ausgegeben werden können; sonst lässt sich der Code nicht erstellen.
          Ein Limit, das sich regelmäßig erneuert (zum Beispiel monatlich), ist erlaubt.
        </li>
        <li>
          Danach prüfen wir das Limit nicht mehr.{' '}
          <strong>Für das Limit Ihres Schlüssels sind Sie verantwortlich</strong>: Erhöhen Sie es später oder erneuert
          es sich, kann über den Schlüssel entsprechend mehr ausgegeben werden. Legen Sie am besten einen eigenen
          Schlüssel nur für AI-Scratch an und begrenzen Sie ihn auf einen Betrag, dessen Verbrauch für Sie in Ordnung
          ist. So bleibt der mögliche Schaden begrenzt, auch wenn der Schlüssel einmal in falsche Hände gerät.
        </li>
        <li>
          Wir speichern den Schlüssel verschlüsselt auf Servern in der EU und verwenden ihn nur für die KI-Anfragen
          Ihrer Codes. Löschen Sie den Schlüssel bei uns, funktionieren die Codes, die ihn verwenden, nicht mehr.
        </li>
        <li>
          Für Ihr Konto bei OpenRouter gelten die Bedingungen von OpenRouter; wir sind nicht Partei dieses Vertrags. Wie
          weit Ihr Guthaben reicht, können wir nicht zusagen: Die Preise legen OpenRouter und die KI-Anbieter fest, das
          KI-Modell und seine Einstellungen wir.
        </li>
        <li>Wenn Sie vermuten, dass jemand anderer Ihren Schlüssel kennt, löschen Sie ihn sofort bei OpenRouter.</li>
      </ul>

      <h2 id="aufsicht">7. Aufsicht und Schutz der Kinder</h2>
      <p>
        <strong>Kinder nutzen AI-Scratch nur unter Aufsicht eines Erwachsenen</strong>: der Lehrkraft, der Eltern oder
        einer anderen verantwortlichen erwachsenen Person, so wie es dem Alter des Kindes entspricht.
      </p>
      <p>
        <strong>Kinder können und sollen AI-Scratch anonym nutzen.</strong> Sie haben kein Konto, und AI-Scratch fragt
        sie nie nach ihrem Namen oder anderen persönlichen Daten.
      </p>
      <p>
        AI-Scratch zeigt den Kindern, dass sie mit einer KI schreiben (dem „KI-Helfer“). Erklären Sie ihnen trotzdem,
        dass hinter den Antworten kein Mensch steht und dass eine KI sich irren kann.
      </p>
      <p>
        <strong>Vor der ersten Nutzung erklären Sie den Kindern</strong>, dass sie mit einer KI schreiben und dass sie
        keine persönlichen oder sensiblen Daten eingeben dürfen, weder in den Chat noch in den Block „frage KI“ noch in
        ihr Scratch-Projekt. Dazu gehören insbesondere:
      </p>
      <ul>
        <li>
          Namen, Adressen, Telefonnummern, E-Mail-Adressen, Geburtsdaten, Schule oder Wohnort des Kindes oder anderer
          Personen;
        </li>
        <li>Fotos, Passwörter und Zugangsdaten;</li>
        <li>
          Gesundheitsdaten und andere besonders schutzwürdige Angaben, etwa zu Herkunft, Religion, politischer Meinung
          oder sexueller Orientierung.
        </li>
      </ul>
      <p>Außerdem gilt:</p>
      <ul>
        <li>
          Antworten einer KI können falsch, unvollständig oder unpassend sein. Ein Jugendschutzfilter prüft, was Kinder
          schreiben, erkennt aber nicht alles. Er ersetzt Ihre Aufsicht nicht.
        </li>
        <li>
          <strong>Nur für Lehrkräfte:</strong> Sie klären die Nutzung im Unterricht nach den Regeln Ihrer Schule.
        </li>
        <li>
          <strong>Nur für Eltern und andere Erwachsene:</strong> Soweit für die Nutzung durch ein Kind die Zustimmung
          einer erziehungsberechtigten Person nötig ist, erteilen Sie diese selbst oder holen sie ein.
        </li>
      </ul>

      <h2 id="datenverarbeitung">8. Wo Daten verarbeitet werden</h2>
      <p>
        <strong>
          Die personenbezogenen Daten der registrierten Erwachsenen speichern und verarbeiten wir auf Servern in der EU
        </strong>
        : etwa Ihre E-Mail-Adresse, die Angaben zu Ihrer Schule, Ihre verschlüsselten OpenRouter-Schlüssel und Ihre
        Zustimmung zu diesen Bedingungen. Ausgenommen ist nur die KI-Prüfung von Registrierungen und Bewerbungen
        (nächster Absatz).
      </p>
      <p>
        <strong>KI-Dienste können außerhalb der EU arbeiten, insbesondere in den USA</strong>, wo ein geringeres
        Datenschutzniveau bestehen kann als in der EU. Das betrifft:
      </p>
      <ul>
        <li>
          was Kinder in den Chat und in den Block „frage KI“ schreiben, und ihr Scratch-Projekt (Figuren, Bilder, Texte,
          Skripte), damit der KI-Helfer antworten kann;
        </li>
        <li>die Prüfung dieser Eingaben zum Schutz der Kinder und gegen Missbrauch der KI-Funktionen;</li>
        <li>die Prüfung von Registrierungen und Bewerbungen gegen Missbrauch.</li>
      </ul>
      <p>
        Die KI-Anbieter sind derzeit Anthropic (direkt oder über OpenRouter, auch über Cloud-Plattformen wie Amazon Web
        Services) und, für den Jugendschutzfilter, TypeSafe. Welcher Anbieter und welches Rechenzentrum eine Anfrage
        bearbeitet, kann sich von Anfrage zu Anfrage ändern. Für die Verarbeitung bei diesen Anbietern gelten auch deren
        Datenschutzbestimmungen. Dieser Verarbeitung stimmen Sie bei der Registrierung ausdrücklich zu.
      </p>
      <p>
        Der Scratch-Editor lädt Figuren, Bilder und Töne aus der Scratch-Bibliothek von Servern der Scratch Foundation
        in den USA, wie auf scratch.mit.edu. Diese Server sehen dabei die IP-Adresse des Geräts.
      </p>

      <h2 id="unterhaltungen">9. Speichern und Auswerten von Unterhaltungen und Spielen</h2>
      <p>
        Wir behalten uns vor, Unterhaltungen von Kindern mit dem KI-Helfer und im Block „frage KI“ sowie die Spiele, die
        sie bauen, zu speichern und auszuwerten:
      </p>
      <ul>
        <li>um AI-Scratch zu verbessern und abzusichern, etwa den Jugendschutzfilter und den Schutz vor Missbrauch;</li>
        <li>
          um zu erforschen, wie Kinder mit KI programmieren lernen, und darüber zu veröffentlichen, etwa in Fachartikeln
          oder Vorträgen.
        </li>
      </ul>
      <p>Dabei gilt:</p>
      <ul>
        <li>
          <strong>Wir verkaufen Unterhaltungen und Spiele nie.</strong> Was wir speichern, liegt auf Servern in der EU.
        </li>
        <li>
          Veröffentlichen wir etwas daraus, dann nur kurze Ausschnitte, zusammengefasste Daten wie statistische
          Auswertungen oder Erkenntnisse, die wir daraus gewonnen haben.
        </li>
        <li>
          <strong>Wir veröffentlichen nie etwas, das Rückschlüsse auf einzelne Personen erlaubt</strong>: weder auf
          Kinder noch auf Eltern, Lehrkräfte oder andere Personen. Ausschnitte prüfen wir vorher darauf und entfernen,
          was auf eine Person hinweisen könnte.
        </li>
        <li>
          Technische Fehlerprotokolle können einzelne Nachrichten oder Teile davon enthalten; wir verwenden sie nur, um
          Fehler zu beheben.
        </li>
      </ul>
      <p>
        Auch deshalb dürfen Kinder keine persönlichen Daten eingeben (<TextLink href="#aufsicht">Abschnitt 7</TextLink>
        ).
      </p>

      <h2 id="spiele">10. Spiele der Kinder und Vorschläge der KI</h2>
      <ul>
        <li>
          Die Spiele, die Kinder bauen, gehören ihnen. Wir beanspruchen daran nur die Nutzung, die{' '}
          <TextLink href="#unterhaltungen">Abschnitt 9</TextLink> beschreibt: speichern, auswerten und kurze Ausschnitte
          veröffentlichen, ohne Rückschluss auf Personen. Damit der KI-Helfer helfen kann, schickt der Browser das
          Projekt mit jeder Nachricht mit (<TextLink href="#datenverarbeitung">Abschnitt 8</TextLink>).
        </li>
        <li>
          Was der KI-Helfer vorschlägt, dürfen Sie und die Kinder frei verwenden, soweit es an uns liegt. Wir sagen
          nicht zu, dass Vorschläge einer KI frei von Rechten anderer sind.
        </li>
        <li>
          Kinder laden keine Bilder, Töne oder Texte in ihr Projekt, an denen andere Rechte haben, und keine Fotos von
          Personen.
        </li>
      </ul>

      <h2 id="andere-dienste">11. Scratch und Dienste anderer</h2>
      <ul>
        <li>
          AI-Scratch verwendet den Scratch-Editor unverändert als Baustein. Scratch ist ein eigenständiges Produkt und
          ein Projekt der Scratch Foundation in Zusammenarbeit mit der Lifelong Kindergarten Group am MIT Media Lab und
          kostenlos unter <TextLink href="https://scratch.mit.edu">scratch.mit.edu</TextLink> verfügbar.{' '}
          <strong>
            AI-Scratch ist kein Angebot der Scratch Foundation oder des MIT und wird von ihnen in keiner Weise
            unterstützt, geprüft oder empfohlen.
          </strong>{' '}
          „Scratch“ ist eine Marke der Scratch Foundation.
        </li>
        <li>
          Zum Speichern ihrer Spiele können Kinder den CoderDojo Locker (locker.coderdojo.net) verwenden. Er ist ein
          eigenständiger, anonymer Dienst, den nicht wir betreiben.
        </li>
        <li>
          Für OpenRouter, die KI-Anbieter und andere Dienste, die AI-Scratch verwendet, gelten auch deren eigene
          Bedingungen.
        </li>
      </ul>

      <h2 id="keine-gewaehr">12. Keine Gewähr, Haftung</h2>
      <ul>
        <li>
          AI-Scratch ist ein kostenloses Angebot ohne Zusagen.{' '}
          <strong>
            Wir sagen weder Verfügbarkeit noch Stabilität noch Fehlerfreiheit zu, und auch nicht, dass bestimmte
            Funktionen bestehen bleiben.
          </strong>
        </li>
        <li>
          Wir können AI-Scratch, einzelne Funktionen, Budgets und Grenzen, das KI-Modell und seine Einstellungen
          jederzeit und ohne Ankündigung ändern, einschränken oder einstellen.
        </li>
        <li>
          Planen Sie Unterricht deshalb so, dass er auch ohne KI-Helfer weitergehen kann, und lassen Sie die Kinder ihre
          Spiele regelmäßig speichern.
        </li>
        <li>Wir sagen nicht zu, dass der KI-Helfer richtig, vollständig oder passend antwortet.</li>
        <li>
          Weil AI-Scratch kostenlos ist, haften wir für Schäden aus seiner Nutzung nur bei Vorsatz und grober
          Fahrlässigkeit, etwa für Kosten auf Ihrem Konto bei OpenRouter oder für verlorene Spiele. Für Personenschäden
          haften wir auch bei leichter Fahrlässigkeit.
        </li>
      </ul>

      <h2 id="missbrauch">13. Missbrauch</h2>
      <ul>
        <li>
          Nutzen Sie AI-Scratch nur für das, wofür es gedacht ist: das Lernen von Kindern. Versuchen Sie nicht, Grenzen,
          Budgets oder den Jugendschutzfilter zu umgehen, und fragen Sie den Dienst nicht automatisiert ab.
        </li>
        <li>
          Bei Verdacht auf Missbrauch können wir Codes, Schlüssel und Konten ohne Vorwarnung sperren oder löschen.
        </li>
        <li>
          Wenn Ihnen eine Lücke beim Schutz von Kindern oder Daten auffällt, schreiben Sie uns bitte: <Mail />
        </li>
      </ul>

      <h2 id="konto-loeschen">14. Ende der Nutzung, Konto löschen</h2>
      <ul>
        <li>
          Sie können die Nutzung jederzeit beenden und Ihr Konto löschen lassen; schreiben Sie dazu an <Mail />. Damit
          widerrufen Sie auch Ihre Zustimmung zur KI-Verarbeitung außerhalb der EU. Wir löschen dann Ihre Daten, Ihre
          Codes und Ihre gespeicherten Schlüssel, soweit wir sie nicht aus rechtlichen Gründen aufbewahren müssen.
        </li>
        <li>
          Auch wir können den Nutzungsvertrag jederzeit beenden, etwa wenn wir AI-Scratch einstellen. Wenn möglich,
          kündigen wir das vorher per E-Mail an.
        </li>
      </ul>

      <h2 id="aenderungen">15. Änderungen, anwendbares Recht, Kontakt</h2>
      <ul>
        <li>
          Wir können diese Bedingungen ändern. Bei einer neuen Fassung bitten wir Sie bei der nächsten Anmeldung erneut
          um Ihre Zustimmung.
        </li>
        <li>
          Es gilt österreichisches Recht. Zwingende Verbraucherschutzbestimmungen Ihres Wohnsitzstaates bleiben
          unberührt.
        </li>
        <li>
          Ist eine Bestimmung dieser Bedingungen unwirksam, bleiben die übrigen wirksam. An die Stelle der unwirksamen
          Bestimmung tritt die gesetzliche Regelung.
        </li>
      </ul>
      <p>
        Kontakt: Rainer Stropek, <Mail />
      </p>
    </>
  );
}
