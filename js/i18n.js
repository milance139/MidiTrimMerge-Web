// English / Srpski texts (same wording as the desktop app, adapted where the browser works differently).
(function (global) {
  'use strict';
  const S = {
    title: ['MIDI Trim & Merge', 'MIDI sečenje i spajanje'],
    helpBtn: ['How to use', 'Uputstvo'],
    helpTitle: ['How to use', 'Uputstvo za korišćenje'],
    close: ['Close', 'Zatvori'],
    helpText: [
      'HOW TO USE\n\n' +
      '1. ADD FILES\n' +
      '   Click "Add files..." or drag .mid files into the window. You can add as many as you like. ' +
      'To change their order, drag a file up or down in the list with the mouse (a line shows where it will land), ' +
      'or use "Move up" / "Move down". "Remove" takes one out of the list.\n\n' +
      '2. TRIM A FILE (optional)\n' +
      '   Select a file in the list. Set the Start and the End time using the separate boxes for minutes (min) and seconds (sec). ' +
      'The End is set to the full length of the song by default, so only change it if you want to cut off the ending. ' +
      'Click "Apply trim". The column "Used part" shows which part of the file will be used. ' +
      '"Reset" brings back the whole file. The original file is never changed.\n\n' +
      '3. MERGE\n' +
      '   Choose the merge mode:\n' +
      '   - One after another: the files play in the order of the list, each one after the previous.\n' +
      '   - Layered: all files play at the same time from the start (tempo is taken from the first file).\n' +
      '   Then click "Merge & Save..." and choose where to save the new .mid file (in some browsers it simply goes to your Downloads folder).\n\n' +
      '4. OVERLAP BETWEEN SONGS (optional)\n' +
      '   WHAT IT DOES: normally the next song starts only after the previous one has completely finished. ' +
      'With overlap, the next song starts a few seconds EARLY, so the ending of one song and the beginning of the next play at the same time. ' +
      'This gives a smooth, continuous transition without a gap or an abrupt switch.\n' +
      '   HOW TO USE: in the bottom bar find "Overlap between songs" and type the number of seconds (0 to 60, steps of 0.5), or use the arrows. ' +
      'Then click "Merge & Save..." as usual. The value 0 means no overlap.\n' +
      '   EXAMPLE: song A is 3:00 long, song B is 2:00 long, overlap is 4 seconds. Song B starts at 2:56, while the last 4 seconds of song A are still playing. ' +
      'The merged song is 4:56 long instead of 5:00 - always shorter by the overlap for every joint between two songs. ' +
      'The "Length of the merged song" label shows the new length immediately.\n' +
      '   GOOD TO KNOW:\n' +
      '   - It works only in "One after another" mode. In "Layered" mode the box is grayed out, because all songs already play together.\n' +
      '   - The overlap is applied to the part of the song that is actually used, so if you trimmed a song, the overlap is taken from the trimmed ending and the trimmed beginning.\n' +
      '   - It is applied between every two neighbouring songs in the list, so the order of the list matters.\n' +
      '   - If a song is shorter than the chosen overlap, the overlap for that joint is automatically reduced to the length of the shorter song.\n' +
      '   - If the next song has a different tempo, its tempo starts only when the overlap is over, so the ending of the previous song does not speed up or slow down.\n' +
      '   - Without "Smooth fade" both songs play at full volume during the overlap. If they use the same instruments (channels), ' +
      'the notes simply sound together, and the next song\'s instrument and volume settings may also affect the ending of the previous one. ' +
      'If it sounds too crowded, use a shorter overlap or trim the end of the first song a little.\n' +
      '   - Good starting values are 2 to 5 seconds. Save the file and listen to it; change the value and save again if needed.\n\n' +
      '5. LISTEN BEFORE YOU SAVE\n' +
      '   "Play selected song" plays the selected song (only the part you set with Start and End, with all its settings). ' +
      '"Play merged result" plays the whole merged song exactly as it will be saved, including the overlaps. ' +
      'Click the same button again (it says Stop) to stop. The sound comes from a synthesizer built into this page (the instrument sounds are downloaded from the internet the first time), ' +
      'so it can sound a little different from your own keyboard or player.\n\n' +
      '6. ADVANCED SETTINGS (button "Advanced settings...")\n' +
      '   The window stays open next to the main one and always shows the song that is selected in the list.\n' +
      '   - Transpose: moves the whole song up or down in semitones (12 = one octave). Drums are not changed. Useful to fit the singer\'s voice.\n' +
      '   - Speed: 100% is normal; 80% is slower, 120% is faster. The length of the song changes with it.\n' +
      '   - Own overlap after this song: normally one overlap value is used for all joints. Tick this box to give the joint between this song and the next one its own value. ' +
      '(Ignored for the last song in the list.)\n' +
      '   - Auto-trim silence: sets Start to the first note and End to the last note, so the quiet beginning and ending are cut off. ' +
      'You can do it for one song or for all songs; check the result in the "Used part" column and change it by hand if you wish.\n' +
      '   - Karaoke text (view / edit): shows the words of the song, one part (syllable) per row with its time (only for files with karaoke text, marked in the Karaoke column). ' +
      'Click into a row to correct the text, or use Find / Replace to fix a letter everywhere. ' +
      'If letters like č, ć, š, ž look wrong, change "Read text as" (Windows-1250 is Latin, Windows-1251 is Cyrillic). ' +
      'Click Apply: the corrected text is saved into the merged .mid file, and the Karaoke column shows ♫*. "Back to original" undoes all changes. ' +
      'The timing of the words never changes.\n' +
      '   - Hide title and credit lines (box in the plain text window and in Live lyrics): many karaoke files put copyright, phone, e-mail and web lines in front of the words. ' +
      'With the box ticked (default) they are left out of what you read and sing from. Only the display changes, never the file. ' +
      'The Karaoke column shows ♫ only for songs that really have words; files that contain nothing but credit lines show –.\n' +
      '   - Show text (plain view): next to it, shows the whole text as ordinary reading text (with your corrections), with a Copy button.\n' +
      '   - Save / Load playlist: saves the list of songs with all their trims and settings to a .mtm file. In this web version the MIDI files are stored inside the playlist, ' +
      'so it can be opened on any computer. A playlist from the desktop program can be loaded too: select the .mtm file together with its MIDI files.\n' +
      '   - Remember...: when ticked, the page remembers the merge mode, overlap and output device.\n' +
      '   Settings changed here are shown in the "Used part" column, for example (+2, 90%).\n\n' +
      '7. MORE TOOLS\n' +
      '   - Seek bar (under the list): drag it to play from any place. Stopping works like a pause: Play continues from the same place. ' +
      'While a single song is playing, "Start here" / "End here" put the playing position into the Start / End boxes; click "Apply trim" to use it.\n' +
      '   - Live lyrics: opens a big window where the words are highlighted while the song plays (works for the selected song and for the merged result).\n' +
      '   - BPM and Key columns: the tempo and key of each song, including your Speed and Transpose settings. A "?" after the key means it was guessed from the notes. ' +
      'Handy for choosing songs that fit one after another.\n' +
      '   - Undo / Redo (or Ctrl+Z / Ctrl+Y): takes back the last changes to the list and the settings, also the ones made in Advanced settings.\n' +
      '   - Smooth fade during overlap: the ending song fades out while the next one fades in. For this the next song may be moved to other MIDI channels, so both can be controlled separately. ' +
      'Untick it to have both play at full volume.\n' +
      '   - In Advanced settings: Volume per song, Instrument change per channel (e.g. piano to accordion), "Match loudness of all songs" and the output device ("Play through") for listening on a connected keyboard or synthesizer ' +
      '(this needs Chrome or Edge; the browser asks for permission to use MIDI devices). ' +
      'The instrument change and the volume are written into the merged file as well.\n\n' +
      '8. YOUR WORK IS KEPT SAFE\n' +
      '   - The list (songs, trims and all settings, and the MIDI files themselves) is saved in this browser automatically a moment after every change, and comes back when you open the page again. ' +
      'You can switch this off in Advanced settings ("Reopen the last list..."). Nothing is uploaded anywhere: all work happens on your own computer.\n' +
      '   - If the page meets an unexpected error, it shows a message, saves the list, and lets you continue.\n\n' +
      'SAVE ONE FILE\n' +
      '   To save only one trimmed file, select it and click "Save this file trimmed...".\n\n' +
      'LANGUAGE\n' +
      '   Use the language box in the bottom bar to switch between English and Srpski.',

      'UPUTSTVO ZA KORIŠĆENJE\n\n' +
      '1. DODAVANJE FAJLOVA\n' +
      '   Kliknite "Dodaj fajlove..." ili prevucite .mid fajlove u prozor. Možete dodati koliko god želite. ' +
      'Redosled menjate prevlačenjem fajla gore ili dole u listi mišem (linija pokazuje gde će sleteti), ' +
      'ili dugmadima "Gore" / "Dole". "Ukloni" izbacuje fajl iz liste.\n\n' +
      '2. SEČENJE FAJLA (nije obavezno)\n' +
      '   Izaberite fajl u listi. Podesite Početak i Kraj pomoću odvojenih polja za minute (min) i sekunde (sek). ' +
      'Kraj je podrazumevano postavljen na punu dužinu pesme, pa ga menjajte samo ako želite da odsečete završetak. ' +
      'Kliknite "Primeni". Kolona "Korišćeni deo" prikazuje koji deo fajla će se koristiti. ' +
      '"Poništi" vraća ceo fajl. Originalni fajl se nikada ne menja.\n\n' +
      '3. SPAJANJE\n' +
      '   Izaberite način spajanja:\n' +
      '   - Jedan za drugim: fajlovi se sviraju redom iz liste, svaki posle prethodnog.\n' +
      '   - Preklopljeno: svi fajlovi sviraju istovremeno od početka (tempo se uzima iz prvog fajla).\n' +
      '   Zatim kliknite "Spoji & Sačuvaj..." i izaberite gde da se sačuva novi .mid fajl (u nekim pregledačima fajl jednostavno ide u fasciklu Preuzimanja).\n\n' +
      '4. PREKLAPANJE PESAMA (nije obavezno)\n' +
      '   ŠTA RADI: obično sledeća pesma počinje tek kada se prethodna potpuno završi. ' +
      'Sa preklapanjem, sledeća pesma počinje nekoliko sekundi RANIJE, pa kraj jedne pesme i početak sledeće sviraju istovremeno. ' +
      'Tako se dobija glatki, neprekidni prelaz bez pauze i bez naglog prekida.\n' +
      '   KAKO SE KORISTI: u donjoj traci pronađite "Preklapanje pesama" i upišite broj sekundi (0 do 60, korak 0,5), ili koristite strelice. ' +
      'Zatim kliknite "Spoji & Sačuvaj..." kao i obično. Vrednost 0 znači bez preklapanja.\n' +
      '   PRIMER: pesma A traje 3:00, pesma B traje 2:00, preklapanje je 4 sekunde. Pesma B počinje u 2:56, dok poslednje 4 sekunde pesme A još sviraju. ' +
      'Spojena pesma traje 4:56 umesto 5:00 - uvek kraće za vrednost preklapanja za svaki spoj dve pesme. ' +
      'Natpis "Dužina spojene pesme" odmah prikazuje novu dužinu.\n' +
      '   DOBRO JE ZNATI:\n' +
      '   - Radi samo u načinu "Jedan za drugim". U načinu "Preklopljeno" polje je zasivljeno, jer sve pesme već sviraju zajedno.\n' +
      '   - Preklapanje se primenjuje na deo pesme koji se zaista koristi, pa ako ste pesmu isekli, uzima se isečeni kraj i isečeni početak.\n' +
      '   - Primenjuje se između svake dve susedne pesme u listi, pa je redosled u listi važan.\n' +
      '   - Ako je pesma kraća od izabranog preklapanja, preklapanje za taj spoj se automatski smanjuje na dužinu kraće pesme.\n' +
      '   - Ako sledeća pesma ima drugačiji tempo, njen tempo počinje tek kada se preklapanje završi, da se kraj prethodne pesme ne bi ubrzao ili usporio.\n' +
      '   - Bez "Postepenog stišavanja" obe pesme sviraju punom jačinom tokom preklapanja. Ako koriste iste instrumente (kanale), ' +
      'note jednostavno sviraju zajedno, a podešavanja instrumenta i jačine sledeće pesme mogu uticati i na kraj prethodne. ' +
      'Ako zvuči prepuno, koristite kraće preklapanje ili malo isecite kraj prve pesme.\n' +
      '   - Dobre početne vrednosti su 2 do 5 sekundi. Sačuvajte fajl i poslušajte ga; po potrebi promenite vrednost i sačuvajte ponovo.\n\n' +
      '5. POSLUŠAJTE PRE ČUVANJA\n' +
      '   "Slušaj izabranu pesmu" pušta izabranu pesmu (samo deo koji ste podesili sa Početak i Kraj, sa svim njenim podešavanjima). ' +
      '"Slušaj spojenu pesmu" pušta celu spojenu pesmu tačno onako kako će biti sačuvana, zajedno sa preklapanjima. ' +
      'Kliknite isto dugme ponovo (piše Zaustavi) da zaustavite. Zvuk dolazi iz sintisajzera ugrađenog u ovu stranicu (zvuci instrumenata se prvi put preuzimaju sa interneta), ' +
      'pa može zvučati malo drugačije nego na vašoj klavijaturi ili plejeru.\n\n' +
      '6. NAPREDNA PODEŠAVANJA (dugme "Napredna podešavanja...")\n' +
      '   Prozor ostaje otvoren pored glavnog i uvek prikazuje pesmu koja je izabrana u listi.\n' +
      '   - Transponovanje: pomera celu pesmu naviše ili naniže u polutonovima (12 = jedna oktava). Bubnjevi se ne menjaju. Korisno da se pesma prilagodi glasu pevača.\n' +
      '   - Brzina: 100% je normalno; 80% je sporije, 120% je brže. Dužina pesme se menja u skladu s tim.\n' +
      '   - Posebno preklapanje posle ove pesme: obično se za sve spojeve koristi jedna vrednost preklapanja. Štiklirajte ovo polje da spoj između ove i sledeće pesme dobije svoju vrednost. ' +
      '(Ne važi za poslednju pesmu u listi.)\n' +
      '   - Ukloni tišinu: postavlja Početak na prvu notu, a Kraj na poslednju notu, pa se tihi početak i kraj odsecaju. ' +
      'Može za jednu pesmu ili za sve pesme; proverite rezultat u koloni "Korišćeni deo" i po želji ga ručno promenite.\n' +
      '   - Karaoke tekst (pregled / izmena): prikazuje reči pesme, jedan deo (slog) po redu sa njegovim vremenom (samo za fajlove sa karaoke tekstom, označene u koloni Karaoke). ' +
      'Kliknite u red da ispravite tekst, ili koristite Traži / Zameni da ispravite slovo svuda. ' +
      'Ako slova poput č, ć, š, ž izgledaju pogrešno, promenite "Čitaj tekst kao" (Windows-1250 je latinica, Windows-1251 je ćirilica). ' +
      'Kliknite Primeni: ispravljen tekst se upisuje u spojeni .mid fajl, a kolona Karaoke prikazuje ♫*. "Vrati original" poništava sve izmene. ' +
      'Vreme reči se nikada ne menja.\n' +
      '   - Sakrij naslov i redove sa autorskim pravima (polje u prozoru sa običnim tekstom i u Tekstu uživo): mnogi karaoke fajlovi ispred reči stavljaju redove sa autorskim pravima, telefonom, e-poštom i web adresom. ' +
      'Kada je polje štiklirano (podrazumevano) oni se izostavljaju iz teksta koji čitate i pevate. Menja se samo prikaz, nikada fajl. ' +
      'Kolona Karaoke prikazuje ♫ samo za pesme koje zaista imaju reči; fajlovi koji sadrže samo redove sa autorskim pravima prikazuju –.\n' +
      '   - Prikaži tekst (običan prikaz): pored njega, prikazuje ceo tekst kao običan tekst za čitanje (sa vašim ispravkama), sa dugmetom Kopiraj.\n' +
      '   - Sačuvaj / Učitaj listu: čuva spisak pesama sa svim sečenjima i podešavanjima u .mtm fajl. U ovoj web verziji MIDI fajlovi se čuvaju unutar liste, ' +
      'pa se može otvoriti na bilo kom računaru. Može se učitati i lista iz programa za računar: izaberite .mtm fajl zajedno sa njegovim MIDI fajlovima.\n' +
      '   - Zapamti...: kada je štiklirano, stranica pamti način spajanja, preklapanje i izlazni uređaj.\n' +
      '   Podešavanja promenjena ovde vide se u koloni "Korišćeni deo", na primer (+2, 90%).\n\n' +
      '7. JOŠ ALATA\n' +
      '   - Traka za premotavanje (ispod liste): prevucite je da pesma krene sa bilo kog mesta. Zaustavljanje radi kao pauza: Slušaj nastavlja sa istog mesta. ' +
      'Dok svira jedna pesma, "Početak ovde" / "Kraj ovde" upisuju trenutni položaj u polja Početak / Kraj; kliknite "Primeni" da se koristi.\n' +
      '   - Tekst uživo: otvara veliki prozor u kome se reči označavaju dok pesma svira (za izabranu pesmu i za spojenu pesmu).\n' +
      '   - Kolone BPM i Ton: tempo i ton svake pesme, uključujući vaša podešavanja Brzine i Transponovanja. "?" posle tona znači da je pogođen iz nota. ' +
      'Korisno za biranje pesama koje se dobro nadovezuju.\n' +
      '   - Opozovi / Ponovi (ili Ctrl+Z / Ctrl+Y): vraća poslednje izmene liste i podešavanja, i one iz Naprednih podešavanja.\n' +
      '   - Postepeno stišavanje pri preklapanju: pesma koja se završava stišava se dok se sledeća pojačava. Zbog toga sledeća pesma može biti premeštena na druge MIDI kanale, da se obe mogu odvojeno kontrolisati. ' +
      'Isključite ako želite da obe sviraju punom jačinom.\n' +
      '   - U Naprednim podešavanjima: Jačina po pesmi, promena instrumenta po kanalu (npr. klavir u harmoniku), "Izjednači jačinu svih pesama" i izlazni uređaj ("Puštaj preko") za slušanje preko priključene klavijature ili sintisajzera ' +
      '(za to je potreban Chrome ili Edge; pregledač traži dozvolu za MIDI uređaje). ' +
      'Promena instrumenta i jačine upisuje se i u spojeni fajl.\n\n' +
      '8. VAŠ RAD JE SIGURAN\n' +
      '   - Lista (pesme, sečenja, sva podešavanja i sami MIDI fajlovi) čuva se automatski u ovom pregledaču trenutak posle svake izmene i vraća se kada ponovo otvorite stranicu. ' +
      'To možete isključiti u Naprednim podešavanjima ("Otvori poslednju listu..."). Ništa se ne šalje na internet: sav rad se odvija na vašem računaru.\n' +
      '   - Ako stranica naiđe na neočekivanu grešku, prikazuje poruku, čuva listu i omogućava vam da nastavite.\n\n' +
      'ČUVANJE JEDNOG FAJLA\n' +
      '   Da sačuvate samo jedan isečen fajl, izaberite ga i kliknite "Sačuvaj ovaj fajl isečen...".\n\n' +
      'JEZIK\n' +
      '   Polje za jezik u donjoj traci menja jezik između English i Srpski.'],
    language: ['Language:', 'Jezik:'],
    debtBtn: ['Debt', 'Dug'],
    debtTitle: ['Debt to Milan', 'Dug prema Milanu'],
    debtLine: ['Debt to Milan:', 'Dug zetu Milanu:'],
    debtNote: ['1 KM for every saved merged song (saved so far: {0})', '1 KM za svaku sačuvanu spojenu pesmu (do sada sačuvano: {0})'],
    total: ['Length of the merged song:', 'Dužina spojene pesme:'],
    smaller: ['Smaller text', 'Manji tekst'],
    larger: ['Larger text', 'Veći tekst'],
    colFile: ['File', 'Fajl'],
    colLen: ['Length', 'Dužina'],
    colUsed: ['Used part', 'Korišćeni deo'],
    colKar: ['Karaoke', 'Karaoke'],
    whole: ['whole file', 'ceo fajl'],
    add: ['Add files...', 'Dodaj fajlove...'],
    remove: ['Remove', 'Ukloni'],
    up: ['Move up', 'Gore'],
    down: ['Move down', 'Dole'],
    trimBox: ['Trim selected file', 'Seci izabrani fajl'],
    start: ['Start', 'Početak'],
    end: ['End', 'Kraj'],
    unitMin: ['min', 'min'],
    unitSec: ['sec', 'sek'],
    apply: ['Apply trim', 'Primeni'],
    reset: ['Reset', 'Poništi'],
    saveOne: ['Save this file trimmed...', 'Sačuvaj ovaj fajl isečen...'],
    mode: ['Merge mode:', 'Način spajanja:'],
    modeSeq: ['One after another (in list order)', 'Jedan za drugim (redom iz liste)'],
    modeLayer: ['Layered (all together, tempo of first file)', 'Preklopljeno (sve istovremeno, tempo prvog fajla)'],
    overlap: ['Overlap between songs:', 'Preklapanje pesama:'],
    overlapSec: ['sec', 'sek'],
    overlapTip: ['The end of each song plays together with the start of the next one for this many seconds (only for "One after another").', 'Kraj svake pesme svira zajedno sa početkom sledeće ovoliko sekundi (samo za "Jedan za drugim").'],
    hideCredits: ['Hide title and credit lines', 'Sakrij naslov i redove sa autorskim pravima'],
    hideCreditsTip: ['Leaves out the copyright, phone, e-mail and web lines that many karaoke files put in front of the words. Only the display changes, never the file.', 'Izostavlja redove sa autorskim pravima, telefonom, e-poštom i web adresom koje mnogi karaoke fajlovi stavljaju ispred reči. Menja se samo prikaz, nikada fajl.'],
    onlyCredits: ['(Only credit lines were found. Untick "Hide title and credit lines" to see them.)', '(Pronađeni su samo redovi sa autorskim pravima. Isključite "Sakrij naslov i redove sa autorskim pravima" da ih vidite.)'],
    restored: ['Your last list was restored ({0} song(s)).', 'Vraćena je vaša poslednja lista (pesama: {0}).'],
    restoreOpt: ['Reopen the last list when the page opens', 'Otvori poslednju listu kada se stranica otvori'],
    crashTitle: ['Unexpected error', 'Neočekivana greška'],
    crashText: ['Something went wrong:\n{0}\n\nYour list was saved automatically and you can continue working.', 'Nešto je pošlo naopako:\n{0}\n\nVaša lista je automatski sačuvana i možete nastaviti sa radom.'],
    colBpm: ['BPM', 'BPM'],
    colKey: ['Key', 'Ton'],
    undo: ['Undo', 'Opozovi'],
    redo: ['Redo', 'Ponovi'],
    fade: ['Smooth fade during overlap', 'Postepeno stišavanje pri preklapanju'],
    fadeTip: ['The ending song fades out while the next one fades in. The next song may be moved to other MIDI channels during the overlap.', 'Pesma koja se završava postepeno se stišava dok se sledeća pojačava. Sledeća pesma može biti premeštena na druge MIDI kanale tokom preklapanja.'],
    setStart: ['Start here', 'Početak ovde'],
    setEnd: ['End here', 'Kraj ovde'],
    setStartTip: ['Put the current playing position into the Start box (then click Apply trim).', 'Upiši trenutni položaj u polje Početak (zatim kliknite Primeni).'],
    setEndTip: ['Put the current playing position into the End box (then click Apply trim).', 'Upiši trenutni položaj u polje Kraj (zatim kliknite Primeni).'],
    startSet: ['Start box set to {0}. Click "Apply trim" to use it.', 'Polje Početak postavljeno na {0}. Kliknite "Primeni" da se koristi.'],
    endSet: ['End box set to {0}. Click "Apply trim" to use it.', 'Polje Kraj postavljeno na {0}. Kliknite "Primeni" da se koristi.'],
    live: ['Live lyrics...', 'Tekst uživo...'],
    liveTitle: ['Live karaoke text', 'Karaoke tekst uživo'],
    liveNone: ['This has no karaoke text.', 'Nema karaoke teksta.'],
    volume: ['Volume (%):', 'Jačina (%):'],
    instrument: ['Instrument:', 'Instrument:'],
    channel: ['Channel:', 'Kanal:'],
    instrOrig: ['(original)', '(original)'],
    matchLoud: ['Match loudness of all songs', 'Izjednači jačinu svih pesama'],
    loudDone: ['Loudness matched for {0} song(s).', 'Jačina izjednačena za pesama: {0}.'],
    device: ['Play through:', 'Puštaj preko:'],
    devDefault: ['Built-in synthesizer', 'Ugrađeni sintisajzer'],
    devNoMidi: ['(this browser has no MIDI device support - use Chrome or Edge)', '(ovaj pregledač ne podržava MIDI uređaje - koristite Chrome ili Edge)'],
    grpSong: ['Selected song', 'Izabrana pesma'],
    grpAll: ['All songs', 'Sve pesme'],
    grpFile: ['Playlist and program', 'Lista i program'],
    play: ['Play selected song', 'Slušaj izabranu pesmu'],
    playAll: ['Play merged result', 'Slušaj spojenu pesmu'],
    stop: ['Stop', 'Zaustavi'],
    playing: ['Playing...', 'Svira...'],
    loadingSounds: ['Loading instrument sounds...', 'Učitavanje zvukova instrumenata...'],
    playFail: ['Could not play: {0}', 'Puštanje nije uspelo: {0}'],
    advBtn: ['Advanced settings...', 'Napredna podešavanja...'],
    advTitle: ['Advanced settings', 'Napredna podešavanja'],
    advSong: ['Settings for the selected song:', 'Podešavanja za izabranu pesmu:'],
    advNone: ['Select a song in the list to change its settings.', 'Izaberite pesmu u listi da biste menjali njena podešavanja.'],
    transpose: ['Transpose (semitones):', 'Transponovanje (polutonovi):'],
    speed: ['Speed (%):', 'Brzina (%):'],
    ovOwn: ['Own overlap after this song:', 'Posebno preklapanje posle ove pesme:'],
    resetSong: ["Reset this song's settings", 'Poništi podešavanja ove pesme'],
    autoOne: ['Auto-trim silence (this song)', 'Ukloni tišinu (ova pesma)'],
    autoAll: ['Auto-trim silence (all songs)', 'Ukloni tišinu (sve pesme)'],
    autoDone: ['Auto-trim: {0} song(s) changed.', 'Automatsko sečenje: promenjeno pesama: {0}.'],
    lyricsBtn: ['Karaoke text (view / edit)...', 'Karaoke tekst (pregled / izmena)...'],
    lyricsPlain: ['Show text (plain view)...', 'Prikaži tekst (običan prikaz)...'],
    plainTitle: ['Karaoke text (plain) - {0}', 'Karaoke tekst (običan) - {0}'],
    copy: ['Copy', 'Kopiraj'],
    lyricsTitle: ['Karaoke text - {0}', 'Karaoke tekst - {0}'],
    lyHelp: ['Click into a row to change its text. A "/" at the start of a part means a new line, "\\" means a new paragraph - keep them where they are.',
      'Kliknite u red da promenite tekst. "/" na početku dela znači novi red, a "\\" novi pasus - ostavite ih gde jesu.'],
    lyTime: ['Time', 'Vreme'],
    lyText: ['Text', 'Tekst'],
    lyEnc: ['Read text as:', 'Čitaj tekst kao:'],
    lyEncAuto: ['Automatic', 'Automatski'],
    lyFind: ['Find:', 'Traži:'],
    lyRepl: ['Replace with:', 'Zameni sa:'],
    lyReplAll: ['Replace all', 'Zameni sve'],
    lyReplDone: ['Replaced in {0} row(s).', 'Zamenjeno u redova: {0}.'],
    lyApply: ['Apply', 'Primeni'],
    lyReset: ['Back to original', 'Vrati original'],
    lyCancel: ['Cancel', 'Otkaži'],
    lyApplied: ['Karaoke text updated for {0}.', 'Karaoke tekst izmenjen za {0}.'],
    lyEncWarn: ['Changing this reloads the text from the original file; your unsaved edits in this window are lost. Continue?', 'Promena ovoga ponovo učitava tekst iz originalnog fajla; izmene u ovom prozoru koje niste primenili biće izgubljene. Nastaviti?'],
    noLyrics: ['This song has no karaoke text.', 'Ova pesma nema karaoke tekst.'],
    savePl: ['Save playlist...', 'Sačuvaj listu...'],
    loadPl: ['Load playlist...', 'Učitaj listu...'],
    plSaved: ['Playlist saved: {0}', 'Lista sačuvana: {0}'],
    plLoaded: ['Loaded {0} song(s) from the playlist.', 'Učitano pesama iz liste: {0}.'],
    plMissing: ['These files could not be loaded (for a playlist from the desktop program, select the .mtm file together with its MIDI files):', 'Ovi fajlovi nisu mogli da se učitaju (za listu iz programa za računar izaberite .mtm fajl zajedno sa njegovim MIDI fajlovima):'],
    plReplace: ['Replace the current list with the playlist?', 'Zameniti trenutnu listu učitanom listom?'],
    plFail: ['Could not read the playlist', 'Lista se ne može pročitati'],
    plNone: ['No .mtm playlist file was selected.', 'Nije izabran .mtm fajl sa listom.'],
    remember: ['Remember merge mode, overlap and output device', 'Zapamti način spajanja, preklapanje i izlazni uređaj'],
    merge: ['Merge & Save...', 'Spoji & Sačuvaj...'],
    hintEmpty: ['Add MIDI files, then select one.', 'Dodajte MIDI fajlove, pa izaberite jedan.'],
    hintSelect: ['Select a file to trim it.', 'Izaberite fajl da biste ga isekli.'],
    statusHelp: ['Add MIDI files with the button or drag them onto this window.', 'Dodajte MIDI fajlove dugmetom ili ih prevucite u ovaj prozor.'],
    dropHere: ['Drop MIDI files here', 'Pustite MIDI fajlove ovde'],
    infoLen: ['Length', 'Dužina'],
    infoTracks: ['Tracks', 'Staze'],
    infoNotes: ['Notes', 'Note'],
    added: ['Added {0} file(s). {1} in list.', 'Dodato fajlova: {0}. U listi: {1}.'],
    loadFail: ['Some files could not be loaded', 'Neki fajlovi nisu mogli da se učitaju'],
    badTimeT: ['Invalid time', 'Neispravno vreme'],
    startBeyond: ['Start is beyond the end of the file.', 'Početak je posle kraja fajla.'],
    endBefore: ['End must be after start.', 'Kraj mora biti posle početka.'],
    trimSet: ['Trim set for {0}.', 'Sečenje podešeno za {0}.'],
    need2: ['Add at least two files to merge.', 'Dodajte bar dva fajla za spajanje.'],
    saved: ['Saved {0}', 'Sačuvano: {0}'],
    merged: ['Merged {0} files into {1} (length {2})', 'Spojeno fajlova: {0} u {1} (dužina {2})'],
    saveFail: ['Could not save', 'Čuvanje nije uspelo'],
    mergeFail: ['Could not merge', 'Spajanje nije uspelo'],
    errNotMidi: ['Not a standard MIDI file.', 'Nije standardni MIDI fajl.'],
    errSmpte: ['SMPTE time-division MIDI files are not supported.', 'MIDI fajlovi sa SMPTE vremenom nisu podržani.'],
    yes: ['Yes', 'Da'],
    no: ['No', 'Ne'],
    ok: ['OK', 'U redu'],
  };

  const L = {
    lang: 0,
    t(key, ...args) {
      const v = S[key] ? S[key][L.lang] : key;
      return args.length ? v.replace(/\{(\d+)\}/g, (m, i) => String(args[+i])) : v;
    },
  };
  global.L = L;
})(window);
