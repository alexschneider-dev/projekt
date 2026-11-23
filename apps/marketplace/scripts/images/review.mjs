import {
  readFile,
  writeFile
} from "node:fs/promises";
import { manifestSchema } from "./schema.mjs";
import { reportFailure } from "../common.mjs";


try {
  const rows = manifestSchema.parse(JSON.parse(await readFile("data/candidates.json", "utf8")));
  const encoded = JSON.stringify(rows).replace(/</g, "\\u003c");
  const html = `<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Produktbilder prüfen</title>
  <style>body{font:16px system-ui;margin:24px;background:#f4f6f5;color:#172d32}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:20px}article{background:white;padding:16px;border-radius:12px}img{width:100%;height:220px;object-fit:contain}select,input{display:block;width:100%;margin:8px 0;padding:8px;box-sizing:border-box}button{padding:14px;margin:20px 0;position:sticky;top:10px}label{display:block}a{color:#176b55}</style>
  <h1>Produktbilder prüfen</h1><p>Nur eindeutige Stuhlmotive auswählen. Merkmale und deutschen Alternativtext ergänzen.</p><p>Fotos von <a href="https://www.pexels.com">Pexels</a>.</p><button id="save">Auswahl als approved.json speichern</button><main></main><script>
  const rows=${encoded};
  const main=document.querySelector('main');
  for(const row of rows){
    const card=document.createElement('article');
    const img=document.createElement('img');img.src=row.previewUrl;img.alt=row.alt;img.loading='lazy';card.append(img);
    const credit=document.createElement('a');credit.href=row.sourceUrl;credit.textContent=row.photographer+' / Pexels';card.append(credit);
    const label=document.createElement('label');const approved=document.createElement('input');approved.type='checkbox';approved.checked=row.approved;approved.onchange=()=>row.approved=approved.checked;label.append(approved,document.createTextNode('Dieses Bild verwenden'));card.append(label);
    for(const [key,values] of Object.entries({material:['Holz','Metall','Kunststoff','Polster'],color:['Natur','Schwarz','Weiß','Grau','Grün'],kind:['Esszimmerstuhl','Bürostuhl','Loungestuhl','Barhocker']})){
      const select=document.createElement('select');select.setAttribute('aria-label',key);for(const value of ['',...values]){const option=document.createElement('option');option.value=value;option.textContent=value||'Bitte wählen';select.append(option)}select.value=row[key]||'';select.onchange=()=>row[key]=select.value;card.append(select);
    }
    const alt=document.createElement('input');alt.setAttribute('aria-label','Deutscher Alternativtext');alt.value=row.alt;alt.oninput=()=>row.alt=alt.value;card.append(alt);main.append(card);
  }
  document.querySelector('#save').onclick=()=>{const data=rows.filter(row=>row.approved);if(data.some(row=>!row.material||!row.color||!row.kind||!row.alt)){alert('Bitte alle Merkmale der ausgewählten Bilder ausfüllen.');return}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='approved.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
  </script></html>`;
  await writeFile("data/review.html", html);
  console.log("Bildauswahl erstellt: data/review.html. approved.json anschließend nach data/ verschieben.");
} catch (error) {
  reportFailure(error);
}
