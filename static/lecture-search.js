/* Search only: a dictated query never becomes an answer or changes a review. */
let LECTURE_SEARCH = {query:'', subject:'', result:null, resultQuery:'', resultSubject:'', error:'', busy:false, request:0, voice:null, topics:null, reading:null};
function searchVoiceActive(){const v=LECTURE_SEARCH.voice;return !!(v&&(v.recording||v.micPending||v.busy))}
function searchVisible(){return !!document.getElementById('v-search')&&!document.getElementById('v-search').hidden}
async function openSearch(query){if(typeof query==='string'&&query!==LECTURE_SEARCH.query){searchPlaybackLeave();searchVoiceLeave();LECTURE_SEARCH.query=query;LECTURE_SEARCH.result=null;LECTURE_SEARCH.error='';LECTURE_SEARCH.request++;LECTURE_SEARCH.busy=false}await tab('search')}
function lectureSearchView(){
 const s=LECTURE_SEARCH;
 $('v-search').innerHTML=`<div class="search-head"><h2>Поиск по всем лекциям</h2><p class="hint">Найди слово или фразу в записях, текстах и разборах. Например: «амигдала».</p></div>
 <form class="box lecture-search-form" id="lecture-search-form"><label for="lecture-search-query">Слово или фраза</label><div class="search-query-row"><input id="lecture-search-query" type="search" maxlength="120" value="${e(s.query)}" placeholder="Что найти?" autocomplete="off"><button class="btn pri" type="submit" id="lecture-search-submit">Найти</button></div>
 <div class="search-options"><label for="lecture-search-subject">Где искать<select id="lecture-search-subject">${subjOptions(s.subject)}</select></label><div class="search-voice-actions"><button class="btn" type="button" id="search-mic" aria-pressed="false">Сказать запрос</button><button class="btn sm" type="button" id="search-voice-cancel" hidden>Отменить запись</button><button class="btn sm" type="button" id="search-voice-retry" hidden>Повторить распознавание</button></div></div><p class="hint" id="search-voice-status" role="status" aria-live="polite">При записи запроса лекция встанет на паузу.</p></form>
 <div id="lecture-search-results" aria-live="polite"></div>`;
 $('lecture-search-form').onsubmit=event=>{event.preventDefault();lectureSearchSubmit()};
 $('lecture-search-query').oninput=()=>{searchPlaybackLeave();searchVoiceLeave();s.query=$('lecture-search-query').value;s.result=null;s.error='';s.request++;s.busy=false;searchControls();searchResultsDraw()};
 $('lecture-search-subject').onchange=()=>{searchPlaybackLeave();s.subject=$('lecture-search-subject').value;s.request++;s.busy=false;if(s.query.trim())lectureSearchSubmit()};
 $('search-mic').onclick=searchVoiceRecord;$('search-voice-cancel').onclick=searchVoiceCancel;$('search-voice-retry').onclick=searchVoiceRetry;
 searchControls();searchResultsDraw();if(s.result)searchTopicsPrime();
}
function searchControls(){if(!searchVisible()||!$('search-mic'))return;const s=LECTURE_SEARCH,v=s.voice,busy=searchVoiceActive();
 const mic=$('search-mic');mic.disabled=!!(v?.micPending||v?.busy);mic.setAttribute('aria-pressed',String(!!v?.recording));mic.classList.toggle('recording',!!v?.recording);mic.textContent=v?.recording?'Остановить и найти':v?.micPending?'Открываю микрофон…':'Сказать запрос';
 $('lecture-search-query').disabled=busy;$('lecture-search-subject').disabled=busy;$('lecture-search-submit').disabled=busy||s.busy;
 $('search-voice-cancel').hidden=!busy;$('search-voice-cancel').textContent=v?.recording||v?.micPending?'Отменить запись':'Отменить распознавание';
 $('search-voice-retry').hidden=!(v?.error&&!busy&&(v.blob||v.job));
 $('search-voice-status').textContent=v?.error||v?.notice||'При записи запроса лекция встанет на паузу.';
 $('search-voice-status').classList.toggle('voice-error',!!v?.error);
}
function searchSnippet(item){const value=String(item.snippet||'');const ranges=(Array.isArray(item.highlights)?item.highlights:[]).filter(x=>Array.isArray(x)&&x.length===2&&Number.isInteger(x[0])&&Number.isInteger(x[1])&&x[0]>=0&&x[1]>x[0]&&x[1]<=value.length).sort((a,b)=>a[0]-b[0]);let last=0,html='';for(const [start,end] of ranges){if(start<last)continue;html+=e(value.slice(last,start))+'<mark>'+e(value.slice(start,end))+'</mark>';last=end}return html+e(value.slice(last))}
function searchTime(value){const n=Math.max(0,Math.floor(Number(value)||0)),h=Math.floor(n/3600);return h?h+':'+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0'):Math.floor(n/60)+':'+String(n%60).padStart(2,'0')}
function searchResultsDraw(){if(!searchVisible()||!$('lecture-search-results'))return;const s=LECTURE_SEARCH,r=s.result,el=$('lecture-search-results');
 if(s.error){el.innerHTML=`<div class="box" role="alert"><p>${e(s.error)}</p><button class="btn" onclick="lectureSearchSubmit()">Попробовать ещё раз</button></div>`;return}
 if(s.busy&&!r){el.innerHTML='<p class="loading-line" role="status">Ищу в лекциях…</p>';return}
 if(!r){el.innerHTML='<p class="hint search-empty">Введи запрос или нажми «Сказать запрос».</p>';return}
 const kinds={audio:'Аудиозапись',transcript:'Текст лекции',explanation:'Разбор',term:'Словарь',title:'Название лекции'},coverage=r.coverage;
 const seen=new Set();const rows=r.items.map((item,index)=>{if(item.kind==='audio'&&item.media_id){const key=item.lecture_id+':'+item.media_id;if(seen.has(key))return '';seen.add(key);return searchTopicSourceHtml(item,index)}return `<article class="box search-result"><p class="meta">${e(item.subject)} · ${e(kinds[item.kind]||'Материал')}</p><h3>${e(item.title)}</h3><p class="search-snippet">${searchSnippet(item)}</p><button class="btn sm" onclick="searchOpenLecture(${index})">Открыть лекцию</button></article>`}).join('');
 searchReadingRemember();el.innerHTML=`<p class="search-count" role="status">Совпадений: <b>${Number(r.total)||0}</b>${s.busy?' · Загружаю…':''}</p>${Array.isArray(r.expanded_terms)&&r.expanded_terms.length>1?`<p class="hint">Ищу также: ${r.expanded_terms.map(x=>'«'+e(x)+'»').join(', ')}.</p>`:''}${coverage?`<p class="hint search-coverage">С таймкодами: ${Number(coverage.timed_audio_lectures)||0} из ${Number(coverage.audio_lectures)||0} аудиолекций. В аудио выделяю законченные объяснения темы; несколько упоминаний в одном объяснении объединяются.</p>`:''}
 <div class="search-results-list">${rows||'<div class="box"><p>Совпадений нет. Попробуй другое слово или более короткую фразу.</p></div>'}</div>
 ${r.has_more?`<button class="btn search-more" onclick="lectureSearchSubmit(true)" ${s.busy?'disabled':''}>Показать ещё</button>`:''}`;searchReadingRender();
}
async function lectureSearchSubmit(more=false){const s=LECTURE_SEARCH;if(searchVoiceActive())return;const query=($('lecture-search-query')?.value??s.query).trim();if(!query||query.length>120){s.error=query?'Введи слово или фразу длиной до 120 знаков.':'Напиши слово или фразу для поиска.';searchResultsDraw();$('lecture-search-query')?.focus();return}
 if(s.busy)return;const serial=++s.request,subject=s.subject,append=more&&s.result&&s.resultQuery===query&&s.resultSubject===subject,offset=append?s.result.items.length:0;s.query=query;s.busy=true;s.error='';if(!append)s.result=null;searchControls();searchResultsDraw();
 try{const response=await fetch(API+'search?q='+encodeURIComponent(query)+'&offset='+offset+(subject?'&subject='+encodeURIComponent(subject):''));const result=await response.json();if(!response.ok)throw new Error(result.error||'Не получилось выполнить поиск.');if(serial!==s.request||!searchVisible())return;s.result=append&&s.result?{...result,items:[...s.result.items,...result.items]}:result;s.resultQuery=query;s.resultSubject=subject;searchTopicsPrime()}
 catch(err){if(serial===s.request)s.error=String(err?.message||err)}finally{if(serial===s.request){s.busy=false;searchControls();searchResultsDraw()}}
}
function searchPlay(index){const item=LECTURE_SEARCH.result?.items[index];if(!item||item.kind!=='audio'||!item.media_id)return;const source=searchTopicSource(item);if(source?.data?.status==='ready'&&source.data.blocks?.length)return searchTopicListen(source.index,0);if(source)return searchTopicPrepare(source.index)}
function searchOpenLecture(index){const item=LECTURE_SEARCH.result?.items[index];if(item)return openLectureDetails(item.lecture_id)}
function searchVoiceCurrent(v){return LECTURE_SEARCH.voice===v&&!v.cancelled&&searchVisible()}
function searchVoiceStop(v,cancel=false){if(!v)return;v.cancelled=cancel;v.recording=false;v.micPending=false;clearInterval(v.timer);try{window.FukushuFX?.voiceStop?.()}catch(_){}try{if(v.recorder&&v.recorder.state!=='inactive')v.recorder.stop()}finally{v.stream?.getTracks().forEach(track=>track.stop())}if(typeof audioRefreshVoice==='function')audioRefreshVoice();searchControls()}
function searchVoiceLeave(){const v=LECTURE_SEARCH.voice;if(!v)return;searchVoiceStop(v,true);LECTURE_SEARCH.voice=null;searchControls()}
function searchVoiceCancel(){searchVoiceLeave()}
async function searchVoiceRecord(){const s=LECTURE_SEARCH;if(s.voice?.recording){searchVoiceStop(s.voice);return}if(searchVoiceActive()||typeof cardVoiceBusy==='function'&&cardVoiceBusy()||typeof LU!=='undefined'&&(LU?.recording||LU?.micPending))return;
 if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined'){s.voice={error:'Запись недоступна. Введи запрос текстом или открой приложение в Safari либо Chrome.'};searchControls();return}
 s.request++;s.busy=false;const v=s.voice={micPending:true,notice:'Разреши доступ к микрофону.'};audioPauseForVoice();searchControls();
 try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(!searchVoiceCurrent(v)){stream.getTracks().forEach(track=>track.stop());return}v.stream=stream;
 const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(type=>MediaRecorder.isTypeSupported(type));const recorder=v.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);v.chunks=[];v.bytes=0;v.recording=true;v.micPending=false;v.notice='Произнеси слово или короткую фразу. Затем нажми «Остановить и найти».';
 recorder.ondataavailable=event=>{if(event.data.size){v.chunks.push(event.data);v.bytes+=event.data.size;if(v.bytes>5*1024*1024){v.error='Запись слишком большая. Произнеси короткий запрос.';searchVoiceStop(v,true)}}};
 recorder.onstop=()=>{clearInterval(v.timer);stream.getTracks().forEach(track=>track.stop());v.recording=false;try{window.FukushuFX?.voiceStop?.()}catch(_){}if(typeof audioRefreshVoice==='function')audioRefreshVoice();if(searchVoiceCurrent(v)){v.blob=new Blob(v.chunks,{type:recorder.mimeType||mime||'audio/webm'});searchVoiceUpload(v)}};
 recorder.onerror=()=>{v.error='Запись прервалась. Попробуй ещё раз или введи запрос текстом.';searchVoiceStop(v,true)};
 recorder.start(500);try{window.FukushuFX?.voiceStart?.(stream,'#lecture-search-query')}catch(_){}v.started=Date.now();v.timer=setInterval(()=>{if(Date.now()-v.started>=30000)searchVoiceStop(v)},500);searchControls();
 }catch(_){if(searchVoiceCurrent(v)){v.error='Не получилось открыть микрофон. Разреши запись или введи запрос текстом.';searchVoiceStop(v,true)}}
}
async function searchVoiceUpload(v){if(!searchVoiceCurrent(v))return;if(!v.blob?.size||v.blob.size>5*1024*1024){v.error='Запись пустая или слишком большая. Запиши короткий запрос.';searchControls();return}v.busy=true;v.error='';v.notice='Распознаю запрос…';searchControls();
 try{let result;if(v.job){result={pending:true,job:v.job}}else{const response=await fetch(API+'search_voice',{method:'POST',headers:{'Content-Type':v.blob.type},body:v.blob});result=await response.json();if(!response.ok)throw new Error(result.error||'Не получилось передать запись.');v.job=result.job}
 while(result.pending){if(!searchVoiceCurrent(v))return;await new Promise(resolve=>setTimeout(resolve,1000));if(!searchVoiceCurrent(v))return;const response=await fetch(API+'search_voice',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({op:'poll',job:v.job})});result=await response.json();if(!response.ok)throw new Error(result.error||'Не получилось распознать запрос.')}
 if(!searchVoiceCurrent(v))return;const query=String(result.transcript||'').trim();if(!query||query.length>120)throw new Error('Произнеси одно слово или короткую фразу. Запрос также можно ввести текстом.');v.busy=false;v.blob=null;v.job=null;v.notice='Распознал запрос: «'+query+'». Его можно исправить в поле поиска.';safelySetSearchQuery(query);searchControls();await lectureSearchSubmit();
 }catch(err){if(searchVoiceCurrent(v)){v.busy=false;v.error=String(err?.message||err);v.notice='';searchControls()}}
 finally{if(LECTURE_SEARCH.voice===v){v.busy=false;v.micPending=false;searchControls()}}
}
function safelySetSearchQuery(query){LECTURE_SEARCH.query=query;if($('lecture-search-query'))$('lecture-search-query').value=query}
function searchVoiceRetry(){const v=LECTURE_SEARCH.voice;if(v&&!v.busy)return searchVoiceUpload(v)}
if(typeof window.addEventListener==='function')window.addEventListener('pagehide',()=>searchVoiceLeave());
