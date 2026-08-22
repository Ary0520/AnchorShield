export default {
  logo: <strong>AnchorShield Docs</strong>,
  
  head: (
    <>
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `window.DocsBotAI=window.DocsBotAI||{},DocsBotAI.init=function(e){return new Promise((t,r)=>{var n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src="https://widget.docsbot.ai/chat.js";let o=document.getElementsByTagName("script")[0];if(o){o.parentNode.insertBefore(n,o)}else{document.head.appendChild(n)}n.addEventListener("load",()=>{let n;Promise.all([new Promise((t,r)=>{window.DocsBotAI.mount(Object.assign({}, e)).then(t).catch(r)}),(n=function e(t){return new Promise(e=>{if(document.querySelector(t))return e(document.querySelector(t));let r=new MutationObserver(n=>{if(document.querySelector(t))return e(document.querySelector(t)),r.disconnect()});r.observe(document.body,{childList:!0,subtree:!0})})})("#docsbotai-root"),]).then(()=>t()).catch(r)}),n.addEventListener("error",e=>{r(e.message)})})};`
        }}
      />
      <script
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `DocsBotAI.init({id: "6mf3Il9MeqzVS5pUKETu/iggKKRt9245iJUGmZsTp"});`
        }}
      />
    </>
  ),

  feedback: {
    content: null
  },
  editLink: {
    component: null
  },
  useNextSeoProps() {
    return {
      titleTemplate: '%s - AnchorShield'
    }
  },
  footer: {
    text: 'AnchorShield Protocol 2026',
  },
  primaryHue: 165,
  primarySaturation: 100,
}