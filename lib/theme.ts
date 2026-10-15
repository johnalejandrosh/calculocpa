export const THEME_STORAGE_KEY = "theme";

/** Se ejecuta en <head> antes del primer pintado para evitar el parpadeo de tema. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
