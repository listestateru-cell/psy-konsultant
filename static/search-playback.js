/* Complete discussions and synchronized reading belong to search only. */
let SEARCH_READER_SERIAL=0,SEARCH_READER_FRAME=null,SEARCH_READER_AUDIO=null;
function searchTopicKey(item){return item.lecture_id+':'+item.media_id}
function searchTopicSource(item){return LECTURE_SEARCH.topics?.sources.find(source=>source.key===searchTopicKey(item))}
function searchTopicCurrent(context){return context===LECTURE_SEARCH.topics&&context.active&&searchVisible()&&context.query===LECTURE_SEARCH.query.trim()}
function searchTopicSourceHtml(item,index){
 const source=searchTopicSource(item),data=source?.data,ready=data?.status==='ready'&&Array.isArray(data.blocks)&&data.blocks.length;
 const head=`<p class="meta">${e(item.subject)} · Объяснение в аудиолекции</p><h3>${e(item.title)}</h3>`;
 if(ready)return `<article class="box search-result search-topic-source">${head}${data.blocks.map((block,number)=>`<section class="search-topic-block"><h4>${e(block.title||'Объяснение темы')}</h4><p>${e(block.summary||'')}</p><p class="hint search-topic-range">${searchTime(block.start)}–${searchTime(block.end)} · ${searchTime(block.end-block.start)}</p><div class="row"><button class="btn sm pri" onclick="searchTopicListen(${source.index},${number})">Слушать объяснение</button><button class="btn sm" onclick="searchOpenLecture(${index})">Открыть лекцию</button></div></section>`).join('')}</article>`;
 const working=!source||source.busy||source.queued,unmatched=data?.status==='unmatched';
 const notice=source?.error||data?.notice||(working?'Выделяю законченное объяснение темы…':'Подготовлю целое обсуждение темы с подводкой и продолжением.');
 return `<article class="box search-result search-topic-source">${head}<p class="search-snippet">${searchSnippet(item)}</p><p class="hint" role="status">${e(notice)}</p><div class="row">${source&&!unmatched?`<button class="btn sm pri" onclick="searchTopicPrepare(${source.index})" ${working?'disabled':''}>${working?'Готовлю объяснение…':source.error?'Повторить подготовку':'Подготовить объяснение'}</button>`:''}<button class="btn sm" onclick="searchOpenLecture(${index})">Открыть лекцию</button></div></article>`;
}
async function searchPlaybackFetch(action,params,post=false){
 const options=post?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(params)}:undefined;
 const response=await fetch(API+action+(post?'':'?'+new URLSearchParams(params)),options);
 let data;try{data=await response.json()}catch(_){throw new Error('Не получилось загрузить фрагмент. Попробуй ещё раз.')}
 if(!response.ok)throw new Error(data.error||data.notice||'Не получилось подготовить фрагмент. Попробуй ещё раз.');return data;
}
async function searchPlaybackPoll(action,data,current){
 while(data.pending){if(!current())return null;await new Promise(resolve=>setTimeout(resolve,1000));if(!current())return null;data=await searchPlaybackFetch(action,{op:'poll',job:data.job},true)}return current()?data:null;
}
function searchTopicsPrime(){
 const state=LECTURE_SEARCH;if(!state.result||!searchVisible())return;const query=state.query.trim();
 let context=state.topics;if(!context||!context.active||context.query!==query){if(context)context.active=false;context=state.topics={query,active:true,sources:[],queue:[],running:false}}
 for(const item of state.result.items){if(item.kind!=='audio'||!item.media_id||context.sources.some(source=>source.key===searchTopicKey(item)))continue;
  const source={key:searchTopicKey(item),index:context.sources.length,item,data:null,error:'',busy:false,queued:true,prepare:context.sources.length<4};context.sources.push(source);context.queue.push(source)}
 searchTopicsDrain(context);
}
async function searchTopicsDrain(context){
 if(context.running)return;context.running=true;
 try{while(context.queue.length&&searchTopicCurrent(context)){
  const source=context.queue.shift();source.queued=false;source.busy=true;source.error='';searchResultsDraw();
  try{const params={lecture_id:source.item.lecture_id,media_id:source.item.media_id,q:context.query};
   let data=await searchPlaybackFetch('search_topics',params);if(!searchTopicCurrent(context))return;source.data=data;
   if(source.prepare&&['pending','busy','error'].includes(data.status)){
    data=await searchPlaybackFetch('search_topics',{...params,op:'prepare'},true);
    if(!searchTopicCurrent(context))return;source.data=data;
    data=await searchPlaybackPoll('search_topics',data,()=>searchTopicCurrent(context));if(!data)return;source.data=data;
   }
  }catch(error){if(searchTopicCurrent(context))source.error=error.message||'Не удалось выделить объяснение.'}
  finally{source.busy=false;if(searchTopicCurrent(context))searchResultsDraw()}
 }}finally{context.running=false}
}
function searchTopicPrepare(index){const context=LECTURE_SEARCH.topics,source=context?.sources[index];if(!source||!searchTopicCurrent(context)||source.busy||source.queued)return;source.prepare=true;source.queued=true;context.queue.push(source);searchResultsDraw();return searchTopicsDrain(context)}
function searchReaderCurrent(reader){return LECTURE_SEARCH.reading===reader&&!reader.cancelled&&searchVisible()&&searchTopicCurrent(reader.context)}
function searchPlaybackLeave(){
 const state=LECTURE_SEARCH;if(state.topics)state.topics.active=false;state.topics=null;
 if(state.reading)state.reading.cancelled=true;state.reading=null;searchReaderFrameStop();searchReaderDockSync();
}
function searchTopicListen(index,number){
 const context=LECTURE_SEARCH.topics,source=context?.sources[index],block=source?.data?.blocks?.[number];
 if(!source||!block||!searchTopicCurrent(context)||source.data.status!=='ready'||!Number.isFinite(block.start)||!Number.isFinite(block.end)||block.end<=block.start)return;
 if(typeof audioVoiceActive==='function'&&audioVoiceActive())return;
 if(LECTURE_SEARCH.reading)LECTURE_SEARCH.reading.cancelled=true;
 const reader=LECTURE_SEARCH.reading={token:++SEARCH_READER_SERIAL,context,source,block,captions:null,error:'',follow:true,active:-1,painted:false,audio:null};
 searchReaderBind();searchResultsDraw();
 // Invoke the native player before any subtitle/network await (iOS gesture).
 const playing=audioPlayExcerpt(source.item.lecture_id,[{start:block.start,end:block.end}],source.item.media_id,block.title||'Объяснение темы',{search:{q:context.query,block_id:block.id}});
 if(typeof window.FukushuMobile?.setAudioExpanded==='function')window.FukushuMobile.setAudioExpanded(true);searchReaderDockSync();
 Promise.resolve(playing).then(()=>{if(!searchReaderCurrent(reader))return;const audio=typeof AU==='undefined'?null:AU;
  if(audio?.lecture_id===source.item.lecture_id&&audio.media_id===source.item.media_id){reader.audio=audio;searchReaderDockSync();searchReaderUpdate();searchReaderFrameStart()}});
 searchReaderLoad(reader);return playing;
}
async function searchReaderLoad(reader){
 const params={lecture_id:reader.source.item.lecture_id,media_id:reader.source.item.media_id,start:reader.block.start,end:reader.block.end,q:reader.context.query,block_id:reader.block.id};
 try{let data=await searchPlaybackFetch('search_captions',params);if(!searchReaderCurrent(reader))return;searchReaderAccept(reader,data);
  if(data.status!=='ready'&&!reader.error){
   data=await searchPlaybackFetch('search_captions',{...params,op:'prepare'},true);if(!searchReaderCurrent(reader))return;
   searchReaderAccept(reader,{...reader.captions,...data});
   data=await searchPlaybackPoll('search_captions',data,()=>searchReaderCurrent(reader));if(!data)return;
   searchReaderAccept(reader,data);
  }
 }catch(error){if(searchReaderCurrent(reader)){reader.error=error.message||'Не получилось загрузить текст.';searchReadingRender()}}
}
function searchReaderAccept(reader,data){reader.captions=data;reader.error=['error','unavailable','source_changed'].includes(data.status)?data.notice||'Подсветка слов пока недоступна. Можно читать текст по фразам.':'';searchReadingRender()}
function searchReadingRemember(){const reader=LECTURE_SEARCH.reading,box=document.getElementById('search-transcript');if(reader&&box)reader.scrollTop=box.scrollTop}
function searchReaderUnits(reader){
 const captions=reader?.captions;if(!captions)return [];
 const rows=captions.status==='ready'&&captions.timing==='word'&&captions.words?.length?captions.words:captions.segments;
 return (Array.isArray(rows)?rows:[]).filter(row=>typeof row.text==='string'&&Number.isFinite(row.start)&&Number.isFinite(row.end)&&row.end>row.start&&row.end>reader.block.start&&row.start<reader.block.end);
}
function searchReaderDockSync(){
 const reader=LECTURE_SEARCH.reading,slot=document.getElementById('search-reading-slot');if(!slot)return;
 if(reader&&searchReaderCurrent(reader)&&!reader.audio&&typeof AU!=='undefined'&&AU?.lecture_id===reader.source.item.lecture_id&&AU.media_id===reader.source.item.media_id){
  const excerpt=typeof audioExcerptCurrent==='function'?audioExcerptCurrent(AU):null;
  if(excerpt?.ranges.some(range=>Math.abs(range.start-reader.block.start)<.1&&Math.abs(range.end-reader.block.end)<.1))reader.audio=AU;
 }
 const visible=!!reader&&searchReaderCurrent(reader)&&searchReaderMatchesAudio(reader);slot.hidden=!visible;
 if(!reader||!searchReaderCurrent(reader)){slot.replaceChildren();delete slot.searchReader;delete slot.searchSignature;return}
 if(visible)searchReadingRender();
}
function searchReaderHasSelection(box){
 const selection=typeof window.getSelection==='function'?window.getSelection():null;
 return !!selection&&!selection.isCollapsed&&(box.contains(selection.anchorNode)||box.contains(selection.focusNode));
}
function searchReadingRender(){
 const reader=LECTURE_SEARCH.reading,slot=document.getElementById('search-reading-slot');if(!reader||!slot||!searchReaderCurrent(reader))return;
 if(!searchReaderMatchesAudio(reader)){slot.hidden=true;return}slot.hidden=false;
 const units=searchReaderUnits(reader),words=reader.captions?.status==='ready'&&reader.captions?.timing==='word';
 const signature=JSON.stringify([units,words,reader.error]);
 // Audio progress and other search jobs must not recreate selected text or controls.
 if(slot.searchReader===reader&&slot.searchSignature===signature){searchReaderFollowButton();searchReaderUpdate();return}
 if(slot.searchReader===reader&&searchReaderHasSelection(slot)){reader.renderDeferred=true;return}
 searchReadingRemember();reader.renderDeferred=false;reader.copyMessage='';
 slot.innerHTML=`<section class="search-reading" aria-label="Текст аудиофрагмента"><div class="search-reading-head"><h4>Текст фрагмента</h4><div class="search-reading-tools"><button class="btn sm" id="search-reader-follow" onclick="searchReaderFollow()" aria-pressed="${reader.follow}">${reader.follow?'Следую за речью':'Следовать за речью'}</button><button class="btn sm" id="search-reader-copy" onclick="searchReaderCopy()" ${units.length?'':'disabled'}>Копировать текст</button></div></div><p class="hint" id="search-caption-status" role="status">${e(reader.error||(words?'Сейчас выделяется произносимое слово.':units.length?'Пока выделяю фразы. Подсветка слов в первый раз готовится несколько минут…':'Загружаю текст объяснения…'))}</p><div class="search-transcript" id="search-transcript" tabindex="0" role="region" aria-label="Расшифровка объяснения" aria-live="off">${units.map((row,index)=>`<span class="search-caption-token${words?'':' search-caption-phrase'}" data-caption="${index}">${e(row.text)}</span>`).join(' ')}</div><p class="hint search-copy-status" id="search-copy-status" role="status" aria-live="polite"></p>${reader.error?'<button class="btn sm" onclick="searchReaderRetry()">Повторить загрузку текста</button>':''}<p class="hint search-reading-range">${searchTime(reader.block.start)}–${searchTime(reader.block.end)}. В конце объяснения запись остановится.</p></section>`;
 slot.searchReader=reader;slot.searchSignature=signature;
 const transcript=document.getElementById('search-transcript');transcript.addEventListener('wheel',searchReaderManual,{passive:true});transcript.addEventListener('touchstart',searchReaderManual,{passive:true});transcript.addEventListener('pointerdown',searchReaderManual,{passive:true});transcript.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))searchReaderManual()});
 if(!reader.follow)transcript.scrollTop=reader.scrollTop||0;reader.units=units;reader.active=-1;reader.painted=false;searchReaderUpdate();
 if(typeof audioLayout==='function')audioLayout();
}
function searchReaderCopyFallback(text){
 const host=document.getElementById('search-reading-slot');if(typeof document.execCommand!=='function'||!host||host.hidden||!host.closest('#audio-dock'))return false;
 const focused=document.activeElement,selection=typeof window.getSelection==='function'?window.getSelection():null,ranges=[];
 if(selection)for(let index=0;index<selection.rangeCount;index++)ranges.push(selection.getRangeAt(index).cloneRange());
 let fieldSelection;try{if(typeof focused?.selectionStart==='number')fieldSelection=[focused.selectionStart,focused.selectionEnd,focused.selectionDirection]}catch(_){}
 const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.tabIndex=-1;field.setAttribute('aria-label','Копируемый текст');field.style.cssText='position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0';host.appendChild(field);
 let copied=false;try{field.focus({preventScroll:true});field.select();field.setSelectionRange(0,text.length);copied=document.execCommand('copy')===true}catch(_){}
 finally{field.remove();try{focused?.focus({preventScroll:true});if(fieldSelection)focused.setSelectionRange(...fieldSelection);if(selection){selection.removeAllRanges();for(const range of ranges)selection.addRange(range)}}catch(_){}}
 return copied;
}
async function searchReaderCopy(){
 const reader=LECTURE_SEARCH.reading;if(!reader||!searchReaderCurrent(reader)||!searchReaderMatchesAudio(reader)||reader.copyBusy)return;
 const text=(reader.units||[]).map(row=>row.text).join(' ').trim();if(!text)return;
 const button=document.getElementById('search-reader-copy');reader.copyBusy=true;if(button){button.disabled=true;button.textContent='Копирую…'}
 let copied=false;try{if(typeof navigator.clipboard?.writeText==='function'){await navigator.clipboard.writeText(text);copied=true}}catch(_){}
 if(!copied&&searchReaderCurrent(reader)&&searchReaderMatchesAudio(reader))copied=searchReaderCopyFallback(text);
 reader.copyBusy=false;if(!searchReaderCurrent(reader)||!searchReaderMatchesAudio(reader))return;
 reader.copyMessage=copied?'Текст фрагмента скопирован.':'Не удалось скопировать. Выдели нужный текст и выбери «Копировать».';
 const status=document.getElementById('search-copy-status'),current=document.getElementById('search-reader-copy');if(status)status.textContent=reader.copyMessage;if(current){current.disabled=false;current.textContent='Копировать текст'}
}
function searchReaderManual(){const reader=LECTURE_SEARCH.reading;if(!reader)return;reader.follow=false;searchReaderFollowButton()}
function searchReaderFollowButton(){const reader=LECTURE_SEARCH.reading,button=document.getElementById('search-reader-follow');if(!reader||!button)return;button.setAttribute('aria-pressed',String(reader.follow));button.textContent=reader.follow?'Следую за речью':'Следовать за речью'}
function searchReaderFollow(){const reader=LECTURE_SEARCH.reading;if(!reader)return;reader.follow=!reader.follow;searchReaderFollowButton();reader.active=-1;searchReaderUpdate()}
function searchReaderRetry(){const reader=LECTURE_SEARCH.reading;if(!reader||!searchReaderCurrent(reader))return;reader.error='';searchReadingRender();return searchReaderLoad(reader)}
function searchReaderMatchesAudio(reader){
 if(!reader.audio||typeof AU==='undefined'||AU!==reader.audio||AU.media_id!==reader.source.item.media_id)return false;
 const excerpt=typeof audioExcerptCurrent==='function'?audioExcerptCurrent(AU):null;
 return !!excerpt&&excerpt.ranges.some(range=>Math.abs(range.start-reader.block.start)<.1&&Math.abs(range.end-reader.block.end)<.1);
}
function searchReaderUpdate(){
 const reader=LECTURE_SEARCH.reading,box=document.getElementById('search-transcript');if(!reader||!box||!searchReaderCurrent(reader))return;
 let audio;try{audio=typeof audioElement==='function'?audioElement():null}catch(_){return}
 const time=typeof audioTimelinePosition==='function'?audioTimelinePosition():audio?.currentTime,units=reader.units||[];let active=-1;
 if(searchReaderMatchesAudio(reader)&&Number.isFinite(time)&&time>=reader.block.start&&time<reader.block.end){
  // Binary search uses measured intervals. Silence has no invented active word.
  let low=0,high=units.length;while(low<high){const mid=(low+high)>>1;if(units[mid].start<=time)low=mid+1;else high=mid}const at=low-1;if(at>=0&&time<units[at].end)active=at;
 }
 if(reader.painted&&reader.active===active)return;reader.painted=true;reader.active=active;
 const nodes=box.querySelectorAll('[data-caption]');for(let index=0;index<nodes.length;index++){nodes[index].classList.toggle('is-current',index===active);if(index===active)nodes[index].setAttribute('aria-current','true');else nodes[index].removeAttribute('aria-current')}
 const target=nodes[active];if(reader.follow&&target){const outer=box.getBoundingClientRect(),inner=target.getBoundingClientRect();if(inner.top<outer.top+24||inner.bottom>outer.bottom-24)box.scrollTop+=inner.top-outer.top-box.clientHeight/3}
}
function searchReaderBind(){
 let audio;try{audio=typeof audioElement==='function'?audioElement():null}catch(_){return}if(!audio||SEARCH_READER_AUDIO===audio)return;SEARCH_READER_AUDIO=audio;
 for(const event of ['timeupdate','seeking','seeked','loadedmetadata','pause','ended','ratechange'])audio.addEventListener(event,()=>{searchReaderUpdate();if(audio.paused)searchReaderFrameStop()});
 audio.addEventListener('play',()=>{searchReaderUpdate();searchReaderFrameStart()});
}
function searchReaderFrameStop(){if(SEARCH_READER_FRAME!==null&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(SEARCH_READER_FRAME);SEARCH_READER_FRAME=null}
function searchReaderFrameStart(){
 if(SEARCH_READER_FRAME!==null||typeof requestAnimationFrame!=='function')return;
 const tick=()=>{SEARCH_READER_FRAME=null;const reader=LECTURE_SEARCH.reading;if(!reader||!searchReaderCurrent(reader))return;searchReaderUpdate();let audio;try{audio=audioElement()}catch(_){return}if(!audio.paused&&searchReaderMatchesAudio(reader))SEARCH_READER_FRAME=requestAnimationFrame(tick)};
 SEARCH_READER_FRAME=requestAnimationFrame(tick);
}
if(typeof document.addEventListener==='function')document.addEventListener('selectionchange',()=>{const reader=LECTURE_SEARCH.reading,slot=document.getElementById('search-reading-slot');if(reader?.renderDeferred&&slot&&!searchReaderHasSelection(slot))searchReadingRender()});
if(typeof window.addEventListener==='function')window.addEventListener('pagehide',()=>searchPlaybackLeave());
