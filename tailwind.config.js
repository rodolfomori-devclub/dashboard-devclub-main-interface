import animate from 'tailwindcss-animate'
const rgb = name => `rgb(var(--${name}-rgb) / <alpha-value>)`
export default {
 content:['./index.html','./src/**/*.{js,ts,jsx,tsx}'], darkMode:'class',
 theme:{ extend:{
 colors:{
 primary:{DEFAULT:rgb('primary'),foreground:'var(--primary-foreground)',dark:'#2448d4',light:'#6b88ff',50:'#eef2ff',100:'#e0e7ff',200:'#c7d2fe',300:'#a5b4fc',400:'#818cf8',500:'#335cff',600:'#2b4bd8',700:'#233db2',800:'#25398e',900:'#25346e'},
 background:{DEFAULT:rgb('canvas'),light:'#f4f6f8',dark:'#111522'},foreground:rgb('text'),border:rgb('border'),input:rgb('border'),ring:rgb('primary'),
 card:{DEFAULT:rgb('surface'),foreground:rgb('text'),dark:'#131720'},popover:{DEFAULT:rgb('surface'),foreground:rgb('text')},
 muted:{DEFAULT:rgb('muted'),foreground:rgb('muted-text')},accent:{DEFAULT:rgb('muted'),foreground:rgb('text'),500:'#8055bd'},secondary:{DEFAULT:rgb('muted'),foreground:rgb('text'),dark:'#131720',light:'#e9eef3'},
 text:{light:'#172b37',dark:'#e9eff5',muted:{light:'#526472',dark:'#abbac9'}},destructive:{DEFAULT:'#bd3345',foreground:'#fff'},error:'var(--error-text)',success:'var(--success)',warning:'#b27b1a',info:'#087f8c',danger:'#bd3345',
 'surface-secondary':{DEFAULT:'#e9eef3',dark:'#263747'},
 },fontFamily:{sans:['Plus Jakarta Sans Variable','Segoe UI','system-ui','sans-serif'],mono:['ui-monospace','monospace']},borderRadius:{lg:'12px',md:'8px',sm:'6px',ds:'12px'},
 keyframes:{'accordion-down':{from:{height:'0'},to:{height:'var(--radix-accordion-content-height)'}},'accordion-up':{from:{height:'var(--radix-accordion-content-height)'},to:{height:'0'}}},animation:{'accordion-down':'accordion-down .2s ease-out','accordion-up':'accordion-up .2s ease-out'},
 },screens:{xs:'475px',sm:'640px',md:'768px',lg:'1024px',xl:'1280px','2xl':'1536px'}},plugins:[animate],
}
