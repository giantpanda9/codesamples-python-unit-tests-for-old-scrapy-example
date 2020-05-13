(function ($) {

// Checks if a given element resides in default extra leaving container page.
function isInExtraLeavingContainer(element) {
  return $(element).closest('div.extlink-extra-leaving').length > 0;
}

Drupal.settings.extlink_extra.colorboxSettings = Drupal.settings.extlink_extra.colorboxSettings || {
  href: Drupal.settings.extlink_extra.extlink_alert_url + ' .extlink-extra-leaving',
  height: '50%',
  width: '50%',
  initialWidth: '50%',
  initialHeight: '50%',
  className: 'extlink-extra-leaving-colorbox',
  onComplete: function () { // Note - drupal colorbox module automatically attaches drupal behaviors to loaded content.
    // Allow our cancel link to close the colorbox.
    jQuery('div.extlink-extra-back-action a').click(function(e) {jQuery.colorbox.close(); return false;})
    extlink_extra_timer();
  },
  onClosed: extlink_stop_timer
};
  
Drupal.behaviors.extlink_extra = {
  // Function mostly duplicated from extlink.js.
  // Returns an array of DOM elements of all external links.
  extlinkAttach: function(context) {
    var settings = Drupal.settings;

    if (!settings.hasOwnProperty('extlink')) {
      return;
    }

    // Strip the host name down, removing ports, subdomains, or www.
    var pattern = /^(([^\/:]+?\.)*)([^\.:]{4,})((\.[a-z]{1,4})*)(:[0-9]{1,5})?$/;
    var host = window.location.host.replace(pattern, '$3$4');
    var subdomain = window.location.host.replace(pattern, '$1');

    // Determine what subdomains are considered internal.
    var subdomains;
    if (settings.extlink.extSubdomains) {
      subdomains = "([^/]*\\.)?";
    }
    else if (subdomain == 'www.' || subdomain == '') {
      subdomains = "(www\\.)?";
    }
    else {
      subdomains = subdomain.replace(".", "\\.");
    }

    // Build regular expressions that define an internal link.
    var internal_link = new RegExp("^https?://" + subdomains + host, "i");

    // Extra internal link matching.
    var extInclude = false;
    if (settings.extlink.extInclude) {
      extInclude = new RegExp(settings.extlink.extInclude.replace(/\\/, '\\'), "i");
    }

    // Extra external link matching.
    var extExclude = false;
    if (settings.extlink.extExclude) {
      extExclude = new RegExp(settings.extlink.extExclude.replace(/\\/, '\\'), "i");
    }

    // Extra external link CSS selector exclusion.
    var extCssExclude = false;
    if (settings.extlink.extCssExclude) {
      extCssExclude = settings.extlink.extCssExclude;
    }

    // Extra external link CSS selector explicit.
    var extCssExplicit = false;
    if (settings.extlink.extCssExplicit) {
      extCssExplicit = settings.extlink.extCssExplicit;
    }

    // Find all links which are NOT internal and begin with http as opposed
    // to ftp://, javascript:, etc. other kinds of links.
    // When operating on the 'this' variable, the host has been appended to
    // all links by the browser, even local ones.
    // In jQuery 1.1 and higher, we'd use a filter method here, but it is not
    // available in jQuery 1.0 (Drupal 5 default).
    var external_links = new Array();
    var mailto_links = new Array();
    $("a, area", context).each(function(el) {
      try {
        var url = this.href.toLowerCase();
        if (url.indexOf('http') == 0
          && (!url.match(internal_link) && !(extExclude && url.match(extExclude)))
          || (extInclude && url.match(extInclude))
          && !(extCssExclude && $(this).parents(extCssExclude).length > 0)
          && !(extCssExplicit && $(this).parents(extCssExplicit).length < 1)) {

          // Add a class of 'extlink' to all external links except those within
          // the 'now leaving' area.
          if (!isInExtraLeavingContainer(this)) {
            $(this).addClass('extlink');
          }

          external_links.push(this);
        }
        // Do not include area tags with begin with mailto: (this prohibits
        // icons from being added to image-maps).
        else if (this.tagName != 'AREA'
          && url.indexOf('mailto:') == 0
          && !(extCssExclude && $(this).parents(extCssExclude).length > 0)
          && !(extCssExplicit && $(this).parents(extCssExplicit).length < 1)) {
          mailto_links.push(this);
        }
      }
        // IE7 throws errors often when dealing with irregular links, such as:
        // <a href="node/10"></a> Empty tags.
        // <a href="http://user:pass@example.com">example</a> User:pass syntax.
      catch (error) {
        return false;
      }
    });

    return external_links;
  },

  // Our click handler for external links.
  clickReaction: function(e) {
    // Allow the default behavior for link if it's within the warning area.
    // This keeps us from firing an infinite loop of reactions.
    if (isInExtraLeavingContainer(this)) {
      return true;
    }
    
    var external_url = jQuery(this).attr('href');
    var back_url = window.location.href;
    var alerturl = Drupal.settings.extlink_extra.extlink_alert_url;
    // Save the URL of the click reaction for use by extlink_extra_timer(). todo - Pass as a variable instead.
    Drupal.settings.extlink_extra.externalUrl = external_url;

    // "Don't warn" pattern matching.
    var extlink_exclude_warning = false;
    if (Drupal.settings.extlink_extra.extlink_exclude_warning) {
      extlink_exclude_warning = new RegExp(Drupal.settings.extlink_extra.extlink_exclude_warning.replace(/\\/, '\\'));
    }
    // Don't do any warnings if the href matches the "don't warn" pattern.
    if (extlink_exclude_warning) {
      var url = external_url.toLowerCase();
      if (url.match(extlink_exclude_warning)) {
        return true;
      }
    }

    // Determine alert type and text to allow code after to override it.
    var alert_type = Drupal.settings.extlink_extra.extlink_alert_type;
    var alert_text = '';
    if (Drupal.settings.extlink.extAlertText) {
      alert_text = Drupal.settings.extlink.extAlertText.value ? Drupal.settings.extlink.extAlertText.value : Drupal.settings.extlink.extAlertText;
    }

    // Colorbox handling.
    if (alert_type == 'colorbox') {
      var alert_type_colorbox_mobile = '';
      if ('extlink_alert_type_colorbox_mobile' in Drupal.settings.extlink_extra) {
        alert_type_colorbox_mobile = Drupal.settings.extlink_extra.extlink_alert_type_colorbox_mobile;
      }

      var alert_text_colorbox_mobile = '';
      if ('extlink_alert_text_colorbox_mobile' in Drupal.settings.extlink_extra) {
        alert_text_colorbox_mobile = Drupal.settings.extlink_extra.extlink_alert_text_colorbox_mobile;
      }

      // Make sure colorbox exists.
      if (!$.isFunction($.colorbox)) {
        // Fallback when colorbox is not available.
        alert_type = alert_type_colorbox_mobile != 'colorbox' ? alert_type_colorbox_mobile : 'confirm';
        if (alert_text_colorbox_mobile) {
          alert_text = alert_text_colorbox_mobile;
        }
      }
      else if (Drupal.settings.colorbox.mobiledetect && window.matchMedia) {
        // Mobile detection extracted from the colorbox module.
        // If the mobile setting is turned on, it will turn off the colorbox modal for mobile devices.

        // Disable Colorbox for small screens.
        mq = window.matchMedia("(max-device-width: " + Drupal.settings.colorbox.mobiledevicewidth + ")");
        if (mq.matches) {
          alert_type = alert_type_colorbox_mobile;
          if (alert_text_colorbox_mobile) {
            alert_text = alert_text_colorbox_mobile;
          }
        }
      }
    }

    // This is what extlink does by default (except
    if (alert_type == 'confirm') {
      var text = alert_text;
      text = text.replace(/\[extlink:external\-url\]/gi, external_url);
      text = text.replace(/\[extlink:back-url\]/gi, back_url);
      return confirm(text);
    }

    // Set cookies that the modal or page can read to determine the 'go to' and 'back' links.
    $.cookie("external_url", external_url, { path: '/' });
    $.cookie("back_url", back_url, { path: '/' });

    if (alert_type == 'colorbox') {
      jQuery.colorbox(Drupal.settings.extlink_extra.colorboxSettings);
      return false;
    }

    if (alert_type == 'page') {
      // If we're here, alert text is on but pop-up is off; we should redirect to an intermediate confirm page.
      window.location = alerturl;
      return false;
    }
  },

  attach: function(context){
    // Build an array of external_links exactly like extlink does.
    var external_links = this.extlinkAttach(context);
    
    // Unbind the click handlers added by extlink and replace with our own
    // This whole section of code that does the finding, unbinding, and rebinding
    // could be made a lot less redundant and more efficient if this issue could be resolved: http://drupal.org/node/1715520
    $(external_links).unbind('click').not('.ext-override, .extlink-extra-leaving a').click(this.clickReaction);
    
    $(document).ready(function() {
      if (Drupal.settings.extlink_extra.extlink_url_override == 1) {
        if (Drupal.settings.extlink_extra.extlink_url_params.external_url) {
          $.cookie("external_url", Drupal.settings.extlink_extra.extlink_url_params.external_url, { path: '/' });
        }
        if (Drupal.settings.extlink_extra.extlink_url_params.back_url) {
          $.cookie("back_url", Drupal.settings.extlink_extra.extlink_url_params.back_url, { path: '/' });
        }
      }
    });
    
    // Dynamically replace hrefs of back and external links on page load. This
    // is to compensate for aggressive caching situations where the now-leaving
    // is returning cached results.
    if (Drupal.settings.extlink_extra.extlink_cache_fix == 1) {
      if (jQuery('.extlink-extra-leaving').length > 0) {
        // grab our cookies
        var external_url = $.cookie("external_url");
        var back_url = $.cookie("back_url");

        // First, find any links within the .extlink-extra-leaving area that use our placeholder text and set their HREFs.
        // Using jquery's attr function here (rather than text replace) is important because IE7 or (IE10+ in
        // compatibility mode, possibly others) will have already turned link HREFs with a value of
        // "external-url-placeholder" into a fully qualified link that has protocol and domain prepended, so we need to
        // replace the whole thing.
        $goLinks = jQuery('.extlink-extra-leaving a[href*=external-url-placeholder]').attr('href', external_url);
        $backLinks = jQuery('.extlink-extra-leaving a[href*=back-url-placeholder]').attr('href', back_url);

        // Respect the 'Open external links in a new window' in our modal/page with aggressive caching.  Use of the text
        // placeholder means that extlink's attach function doesn't catch these.
        if (Drupal.settings.extlink.extTarget) {
          // Apply the 'target' attribute to the 'go' links.
          $goLinks.attr('target', Drupal.settings.extlink.extTarget);
        }

        // Next find any other places within text or whatever that have the placeholder text.
        var html = jQuery('.extlink-extra-leaving').html();
        html = html.replace(/external-url-placeholder/gi, external_url);
        html = html.replace(/back-url-placeholder/gi, back_url);
        jQuery('.extlink-extra-leaving').html(html);
      }
    }

    // If the timer is configured, we'll call it for the intermediate page.
    if (Drupal.settings.extlink_extra.extlink_alert_type == 'page') {
      if (jQuery('.extlink-extra-leaving').length > 0) {
        extlink_extra_timer();
      }
    }

    // Apply 508 fix - extlink module makes empty <spans> to show the external link icon, screen readers
    // have trouble with this.
    if (Drupal.settings.extlink_extra.extlink_508_fix == 1) {
      // Go through each <a> tag with an 'ext' class,
      $.each($("a.ext"), function(index, value) {
        // find a <span> next to it with 'ext' class,
        var nextSpan = $(this).next('span.ext');
        if (nextSpan.length) {
          // if found add the text 'External Link' to the empty <span> (or whatever is configured by the user)
          nextSpan.html(Drupal.settings.extlink_extra.extlink_508_text);

          // and move the span inside the <a> tag (at the end).
          $(this).append(nextSpan);
        }
      });
    }
  }
}

})(jQuery);

// Global var that will be our JS interval.
var extlink_int;

// Handles the automatic redirection timer
function extlink_extra_timer() {
  // Don't start the timer if the time is set to '0' or somehow null
  if (Drupal.settings.extlink_extra.extlink_alert_timer == 0 || Drupal.settings.extlink_extra.extlink_alert_timer == null) {
    return;
  }

  // Initialize the time, grab the container, and update the markup.
  var count = Drupal.settings.extlink_extra.extlink_alert_timer;
  var container = jQuery('.automatic-redirect-countdown');
  extlink_update_countdown_markup(container, count);

  // Decrement the timer each second
  extlink_int = setInterval(function () {
    if (count >= 0) {
      extlink_update_countdown_markup(container, count);
      count--;
    }
    else {
      // Time's up! Stop the timer and redirect.
      extlink_stop_timer();
      if (typeof Drupal.settings.extlink_extra.externalUrl != 'undefined') {
        window.location = Drupal.settings.extlink_extra.externalUrl;
      }
      else {
        // If the user is using the 'intermediate page' method of warning, a click reaction won't have set
        // Drupal.settings.extlink_extra.externalUrl and it will be null - so we should fall back on the cookie for
        // our destination.
        window.location = jQuery.cookie("external_url");
      }
    }
  }, 1000);
}

function extlink_stop_timer() {
  clearInterval(extlink_int);
}

function extlink_update_countdown_markup(container, count) {
  container.html('<span class="extlink-timer-text">Automatically redirecting in: </span><span class="extlink-count">'+count+'</span><span class="extlink-timer-text"> seconds.</span>');
}
;/**/
(function(w,undefined){function shoestring(prim,sec){var pType=typeof(prim),ret=[],sel;if(!prim){return new Shoestring(ret);}
if(prim.call){return shoestring.ready(prim);}
if(prim.constructor===Shoestring&&!sec){return prim;}
if(pType==="string"&&prim.indexOf("<")===0){var dfrag=document.createElement("div");dfrag.innerHTML=prim;return shoestring(dfrag).children().each(function(){dfrag.removeChild(this);});}
if(pType==="string"){if(sec){return shoestring(sec).find(prim);}
sel=document.querySelectorAll(prim);return new Shoestring(sel,prim);}
if(Object.prototype.toString.call(pType)==='[object Array]'||(window.NodeList&&prim instanceof window.NodeList)){return new Shoestring(prim,prim);}
if(prim.constructor===Array){return new Shoestring(prim,prim);}
return new Shoestring([prim],prim);}
var Shoestring=function(ret,prim){this.length=0;this.selector=prim;shoestring.merge(this,ret);};Shoestring.prototype.reverse=[].reverse;shoestring.fn=Shoestring.prototype;shoestring.Shoestring=Shoestring;shoestring.extend=function(first,second){for(var i in second){if(second.hasOwnProperty(i)){first[i]=second[i];}}
return first;};shoestring.merge=function(first,second){var len,j,i;len=+second.length,j=0,i=first.length;for(;j<len;j++){first[i++]=second[j];}
first.length=i;return first;};window.shoestring=shoestring;shoestring.fn.each=function(callback){return shoestring.each(this,callback);};shoestring.each=function(collection,callback){var val;for(var i=0,il=collection.length;i<il;i++){val=callback.call(collection[i],i,collection[i]);if(val===false){break;}}
return collection;};shoestring.inArray=function(needle,haystack){var isin=-1;for(var i=0,il=haystack.length;i<il;i++){if(haystack.hasOwnProperty(i)&&haystack[i]===needle){isin=i;}}
return isin;};shoestring.ready=function(fn){if(ready&&fn){fn.call(document);}
else if(fn){readyQueue.push(fn);}
else{runReady();}
return[document];};shoestring.fn.ready=function(fn){shoestring.ready(fn);return this;};var ready=false,readyQueue=[],runReady=function(){if(!ready){while(readyQueue.length){readyQueue.shift().call(document);}
ready=true;}};if(!window.addEventListener){window.addEventListener=function(evt,cb){return window.attachEvent("on"+evt,cb);};}
if(document.attachEvent?document.readyState==="complete":document.readyState!=="loading"){runReady();}else{if(!document.addEventListener){document.attachEvent("DOMContentLoaded",runReady);document.attachEvent("onreadystatechange",runReady);}else{document.addEventListener("DOMContentLoaded",runReady,false);document.addEventListener("readystatechange",runReady,false);}
window.addEventListener("load",runReady,false);}
shoestring.fn.is=function(selector){var ret=false,self=this,parents,check;if(typeof selector!=="string"){if(selector.length&&selector[0]){check=selector;}else{check=[selector];}
return _checkElements(this,check);}
parents=this.parent();if(!parents.length){parents=shoestring(document);}
parents.each(function(i,e){var children;children=e.querySelectorAll(selector);ret=_checkElements(self,children);});return ret;};function _checkElements(needles,haystack){var ret=false;needles.each(function(){var j=0;while(j<haystack.length){if(this===haystack[j]){ret=true;}
j++;}});return ret;}
shoestring.fn.data=function(name,value){if(name!==undefined){if(value!==undefined){return this.each(function(){if(!this.shoestringData){this.shoestringData={};}
this.shoestringData[name]=value;});}
else{if(this[0]){if(this[0].shoestringData){return this[0].shoestringData[name];}}}}
else{return this[0]?this[0].shoestringData||{}:undefined;}};shoestring.fn.removeData=function(name){return this.each(function(){if(name!==undefined&&this.shoestringData){this.shoestringData[name]=undefined;delete this.shoestringData[name];}else{this[0].shoestringData={};}});};window.$=shoestring;shoestring.fn.addClass=function(className){var classes=className.replace(/^\s+|\s+$/g,'').split(" ");return this.each(function(){for(var i=0,il=classes.length;i<il;i++){if(this.className!==undefined&&(this.className===""||!this.className.match(new RegExp("(^|\\s)"+classes[i]+"($|\\s)")))){this.className+=" "+classes[i];}}});};shoestring.fn.add=function(selector){var ret=[];this.each(function(){ret.push(this);});shoestring(selector).each(function(){ret.push(this);});return shoestring(ret);};shoestring.fn.append=function(fragment){if(typeof(fragment)==="string"||fragment.nodeType!==undefined){fragment=shoestring(fragment);}
return this.each(function(i){for(var j=0,jl=fragment.length;j<jl;j++){this.appendChild(i>0?fragment[j].cloneNode(true):fragment[j]);}});};shoestring.fn.appendTo=function(selector){return this.each(function(){shoestring(selector).append(this);});};shoestring.fn.attr=function(name,value){var nameStr=typeof(name)==="string";if(value!==undefined||!nameStr){return this.each(function(){if(nameStr){this.setAttribute(name,value);}else{for(var i in name){if(name.hasOwnProperty(i)){this.setAttribute(i,name[i]);}}}});}else{return this[0]?this[0].getAttribute(name):undefined;}};shoestring.fn.before=function(fragment){if(typeof(fragment)==="string"||fragment.nodeType!==undefined){fragment=shoestring(fragment);}
return this.each(function(i){for(var j=0,jl=fragment.length;j<jl;j++){this.parentNode.insertBefore(i>0?fragment[j].cloneNode(true):fragment[j],this);}});};shoestring.fn.children=function(){var ret=[],childs,j;this.each(function(){childs=this.children;j=-1;while(j++<childs.length-1){if(shoestring.inArray(childs[j],ret)===-1){ret.push(childs[j]);}}});return shoestring(ret);};shoestring.fn.closest=function(selector){var ret=[];if(!selector){return shoestring(ret);}
this.each(function(){var element,$self=shoestring(element=this);if($self.is(selector)){ret.push(this);return;}
while(element.parentElement){if(shoestring(element.parentElement).is(selector)){ret.push(element.parentElement);break;}
element=element.parentElement;}});return shoestring(ret);};shoestring.cssExceptions={'float':['cssFloat','styleFloat']};(function(){function getComputedStylePixel(element,property,fontSize){element.document;var
value=element.currentStyle[property].match(/([\d\.]+)(%|cm|em|in|mm|pc|pt|)/)||[0,0,''],size=value[1],suffix=value[2],rootSize;fontSize=!fontSize?fontSize:/%|em/.test(suffix)&&element.parentElement?getComputedStylePixel(element.parentElement,'fontSize',null):16;rootSize=property==='fontSize'?fontSize:/width/i.test(property)?element.clientWidth:element.clientHeight;return suffix==='%'?size / 100*rootSize:suffix==='cm'?size*0.3937*96:suffix==='em'?size*fontSize:suffix==='in'?size*96:suffix==='mm'?size*0.3937*96 / 10:suffix==='pc'?size*12*96 / 72:suffix==='pt'?size*96 / 72:size;}
function setShortStyleProperty(style,property){var
borderSuffix=property==='border'?'Width':'',t=property+'Top'+borderSuffix,r=property+'Right'+borderSuffix,b=property+'Bottom'+borderSuffix,l=property+'Left'+borderSuffix;style[property]=(style[t]===style[r]&&style[t]===style[b]&&style[t]===style[l]?[style[t]]:style[t]===style[b]&&style[l]===style[r]?[style[t],style[r]]:style[l]===style[r]?[style[t],style[r],style[b]]:[style[t],style[r],style[b],style[l]]).join(' ');}
function CSSStyleDeclaration(element){var
style=this,currentStyle=element.currentStyle,fontSize=getComputedStylePixel(element,'fontSize'),unCamelCase=function(match){return'-'+match.toLowerCase();},property;for(property in currentStyle){Array.prototype.push.call(style,property==='styleFloat'?'float':property.replace(/[A-Z]/,unCamelCase));if(property==='width'){style[property]=element.offsetWidth+'px';}else if(property==='height'){style[property]=element.offsetHeight+'px';}else if(property==='styleFloat'){style.float=currentStyle[property];}else if(/margin.|padding.|border.+W/.test(property)&&style[property]!=='auto'){style[property]=Math.round(getComputedStylePixel(element,property,fontSize))+'px';}else if(/^outline/.test(property)){try{style[property]=currentStyle[property];}catch(error){style.outlineColor=currentStyle.color;style.outlineStyle=style.outlineStyle||'none';style.outlineWidth=style.outlineWidth||'0px';style.outline=[style.outlineColor,style.outlineWidth,style.outlineStyle].join(' ');}}else{style[property]=currentStyle[property];}}
setShortStyleProperty(style,'margin');setShortStyleProperty(style,'padding');setShortStyleProperty(style,'border');style.fontSize=Math.round(fontSize)+'px';}
CSSStyleDeclaration.prototype={constructor:CSSStyleDeclaration,getPropertyPriority:function(){throw new Error('NotSupportedError: DOM Exception 9');},getPropertyValue:function(property){return this[property.replace(/-\w/g,function(match){return match[1].toUpperCase();})];},item:function(index){return this[index];},removeProperty:function(){throw new Error('NoModificationAllowedError: DOM Exception 7');},setProperty:function(){throw new Error('NoModificationAllowedError: DOM Exception 7');},getPropertyCSSValue:function(){throw new Error('NotSupportedError: DOM Exception 9');}};if(!window.getComputedStyle){window.getComputedStyle=function(element){return new CSSStyleDeclaration(element);};if(window.Window){window.Window.prototype.getComputedStyle=window.getComputedStyle;}}})();(function(){var cssExceptions=shoestring.cssExceptions;function convertPropertyName(str){return str.replace(/\-([A-Za-z])/g,function(match,character){return character.toUpperCase();});}
function _getStyle(element,property){return window.getComputedStyle(element,null).getPropertyValue(property);}
var vendorPrefixes=['','-webkit-','-ms-','-moz-','-o-','-khtml-'];shoestring._getStyle=function(element,property){var convert,value,j,k;if(cssExceptions[property]){for(j=0,k=cssExceptions[property].length;j<k;j++){value=_getStyle(element,cssExceptions[property][j]);if(value){return value;}}}
for(j=0,k=vendorPrefixes.length;j<k;j++){convert=convertPropertyName(vendorPrefixes[j]+property);value=_getStyle(element,convert);if(convert!==property){value=value||_getStyle(element,property);}
if(vendorPrefixes[j]){value=value||_getStyle(element,vendorPrefixes[j]+property);}
if(value){return value;}}
return undefined;};})();(function(){var cssExceptions=shoestring.cssExceptions;function convertPropertyName(str){return str.replace(/\-([A-Za-z])/g,function(match,character){return character.toUpperCase();});}
shoestring._setStyle=function(element,property,value){var convertedProperty=convertPropertyName(property);element.style[property]=value;if(convertedProperty!==property){element.style[convertedProperty]=value;}
if(cssExceptions[property]){for(var j=0,k=cssExceptions[property].length;j<k;j++){element.style[cssExceptions[property][j]]=value;}}};})();shoestring.fn.css=function(property,value){if(!this[0]){return;}
if(typeof property==="object"){return this.each(function(){for(var key in property){if(property.hasOwnProperty(key)){shoestring._setStyle(this,key,property[key]);}}});}else{if(value!==undefined){return this.each(function(){shoestring._setStyle(this,property,value);});}
return shoestring._getStyle(this[0],property);}};shoestring.fn.eq=function(index){if(this[index]){return shoestring(this[index]);}
return shoestring([]);};shoestring.fn.filter=function(selector){var ret=[];this.each(function(index){var wsel;if(typeof selector==='function'){if(selector.call(this,index)!==false){ret.push(this);}}else{if(!this.parentNode){var context=shoestring(document.createDocumentFragment());context[0].appendChild(this);wsel=shoestring(selector,context);}else{wsel=shoestring(selector,this.parentNode);}
if(shoestring.inArray(this,wsel)>-1){ret.push(this);}}});return shoestring(ret);};shoestring.fn.find=function(selector){var ret=[],finds;this.each(function(){finds=this.querySelectorAll(selector);for(var i=0,il=finds.length;i<il;i++){ret=ret.concat(finds[i]);}});return shoestring(ret);};shoestring.fn.first=function(){return this.eq(0);};shoestring.fn.get=function(index){return this[index];};var set=function(html){if(typeof html==="string"){return this.each(function(){this.innerHTML=html;});}else{var h="";if(typeof html.length!=="undefined"){for(var i=0,l=html.length;i<l;i++){h+=html[i].outerHTML;}}else{h=html.outerHTML;}
return this.each(function(){this.innerHTML=h;});}};shoestring.fn.html=function(html){if(typeof html!=="undefined"){return set.call(this,html);}else{var pile="";this.each(function(){pile+=this.innerHTML;});return pile;}};(function(){function _getIndex(set,test){var i,result,element;for(i=result=0;i<set.length;i++){element=set.item?set.item(i):set[i];if(test(element)){return result;}
if(element.nodeType===1){result++;}}
return-1;}
shoestring.fn.index=function(selector){var self,children;self=this;if(selector===undefined){children=((this[0]&&this[0].parentNode)||document.documentElement).childNodes;return _getIndex(children,function(element){return self[0]===element;});}else{return _getIndex(self,function(element){return element===(shoestring(selector,element.parentNode)[0]);});}};})();shoestring.fn.insertBefore=function(selector){return this.each(function(){shoestring(selector).before(this);});};shoestring.fn.last=function(){return this.eq(this.length-1);};shoestring.fn.next=function(){var result=[];this.each(function(){var children,item,found;children=shoestring(this.parentNode)[0].childNodes;for(var i=0;i<children.length;i++){item=children.item(i);if(found&&item.nodeType===1){result.push(item);break;}
if(item===this){found=true;}}});return shoestring(result);};shoestring.fn.not=function(selector){var ret=[];this.each(function(){var found=shoestring(selector,this.parentNode);if(shoestring.inArray(this,found)===-1){ret.push(this);}});return shoestring(ret);};shoestring.fn.parent=function(){var ret=[],parent;this.each(function(){parent=(this===document.documentElement?document:this.parentNode);if(parent&&parent.nodeType!==11){ret.push(parent);}});return shoestring(ret);};shoestring.fn.prepend=function(fragment){if(typeof(fragment)==="string"||fragment.nodeType!==undefined){fragment=shoestring(fragment);}
return this.each(function(i){for(var j=0,jl=fragment.length;j<jl;j++){var insertEl=i>0?fragment[j].cloneNode(true):fragment[j];if(this.firstChild){this.insertBefore(insertEl,this.firstChild);}else{this.appendChild(insertEl);}}});};shoestring.fn.prev=function(){var result=[];this.each(function(){var children,item,found;children=shoestring(this.parentNode)[0].childNodes;for(var i=children.length-1;i>=0;i--){item=children.item(i);if(found&&item.nodeType===1){result.push(item);break;}
if(item===this){found=true;}}});return shoestring(result);};shoestring.fn.prevAll=function(){var result=[];this.each(function(){var $previous=shoestring(this).prev();while($previous.length){result.push($previous[0]);$previous=$previous.prev();}});return shoestring(result);};shoestring.fn.removeAttr=function(name){return this.each(function(){this.removeAttribute(name);});};shoestring.fn.removeClass=function(cname){var classes=cname.replace(/^\s+|\s+$/g,'').split(" ");return this.each(function(){var newClassName,regex;for(var i=0,il=classes.length;i<il;i++){if(this.className!==undefined){regex=new RegExp("(^|\\s)"+classes[i]+"($|\\s)","gmi");newClassName=this.className.replace(regex," ");this.className=newClassName.replace(/^\s+|\s+$/g,'');}}});};shoestring.fn.remove=function(){return this.each(function(){if(this.parentNode){this.parentNode.removeChild(this);}});};shoestring.fn.replaceWith=function(fragment){if(typeof(fragment)==="string"){fragment=shoestring(fragment);}
var ret=[];if(fragment.length>1){fragment=fragment.reverse();}
this.each(function(i){var clone=this.cloneNode(true),insertEl;ret.push(clone);if(!this.parentNode){return;}
if(fragment.length===1){insertEl=i>0?fragment[0].cloneNode(true):fragment[0];this.parentNode.replaceChild(insertEl,this);}else{for(var j=0,jl=fragment.length;j<jl;j++){insertEl=i>0?fragment[j].cloneNode(true):fragment[j];this.parentNode.insertBefore(insertEl,this.nextSibling);}
this.parentNode.removeChild(this);}});return shoestring(ret);};shoestring.fn.siblings=function(){if(!this.length){return shoestring([]);}
var sibs=[],el=this[0].parentNode.firstChild;do{if(el.nodeType===1&&el!==this[0]){sibs.push(el);}
el=el.nextSibling;}while(el);return shoestring(sibs);};var getText=function(elem){var node,ret="",i=0,nodeType=elem.nodeType;if(!nodeType){while((node=elem[i++])){ret+=getText(node);}}else if(nodeType===1||nodeType===9||nodeType===11){if(typeof elem.textContent==="string"){return elem.textContent;}else{for(elem=elem.firstChild;elem;elem=elem.nextSibling){ret+=getText(elem);}}}else if(nodeType===3||nodeType===4){return elem.nodeValue;}
return ret;};shoestring.fn.text=function(){return getText(this);};shoestring.fn.val=function(value){var el;if(value!==undefined){return this.each(function(){if(this.tagName==="SELECT"){var optionSet,option,options=this.options,values=[],i=options.length,newIndex;values[0]=value;while(i--){option=options[i];if((option.selected=shoestring.inArray(option.value,values)>=0)){optionSet=true;newIndex=i;}}
if(!optionSet){this.selectedIndex=-1;}else{this.selectedIndex=newIndex;}}else{this.value=value;}});}else{el=this[0];if(el.tagName==="SELECT"){if(el.selectedIndex<0){return"";}
return el.options[el.selectedIndex].value;}else{return el.value;}}};shoestring._dimension=function(set,name,value){var offsetName;if(value===undefined){offsetName=name.replace(/^[a-z]/,function(letter){return letter.toUpperCase();});return set[0]["offset"+offsetName];}else{value=typeof value==="string"?value:value+"px";return set.each(function(){this.style[name]=value;});}};shoestring.fn.width=function(value){return shoestring._dimension(this,"width",value);};shoestring.fn.wrapInner=function(html){return this.each(function(){var inH=this.innerHTML;this.innerHTML="";shoestring(this).append(shoestring(html).html(inH));});};function initEventCache(el,evt){if(!el.shoestringData){el.shoestringData={};}
if(!el.shoestringData.events){el.shoestringData.events={};}
if(!el.shoestringData.loop){el.shoestringData.loop={};}
if(!el.shoestringData.events[evt]){el.shoestringData.events[evt]=[];}}
function addToEventCache(el,evt,eventInfo){var obj={};obj.isCustomEvent=eventInfo.isCustomEvent;obj.callback=eventInfo.callfunc;obj.originalCallback=eventInfo.originalCallback;obj.namespace=eventInfo.namespace;el.shoestringData.events[evt].push(obj);if(eventInfo.customEventLoop){el.shoestringData.loop[evt]=eventInfo.customEventLoop;}}
function reorderEvents(node,eventName){if(node.addEventListener||!node.shoestringData||!node.shoestringData.events){return;}
var otherEvents=node.shoestringData.events[eventName]||[];for(var j=otherEvents.length-1;j>=0;j--){if(!otherEvents[j].isCustomEvent){node.detachEvent("on"+eventName,otherEvents[j].callback);node.attachEvent("on"+eventName,otherEvents[j].callback);}}}
shoestring.fn.bind=function(evt,data,originalCallback){if(typeof data==="function"){originalCallback=data;data=null;}
var evts=evt.split(" "),docEl=document.documentElement;function encasedCallback(e,namespace,triggeredElement){var result;if(e._namespace&&e._namespace!==namespace){return;}
e.data=data;e.namespace=e._namespace;var returnTrue=function(){return true;};e.isDefaultPrevented=function(){return false;};var originalPreventDefault=e.preventDefault;var preventDefaultConstructor=function(){if(originalPreventDefault){return function(){e.isDefaultPrevented=returnTrue;originalPreventDefault.call(e);};}else{return function(){e.isDefaultPrevented=returnTrue;e.returnValue=false;};}};e.target=triggeredElement||e.target||e.srcElement;e.preventDefault=preventDefaultConstructor();e.stopPropagation=e.stopPropagation||function(){e.cancelBubble=true;};result=originalCallback.apply(this,[e].concat(e._args));if(result===false){e.preventDefault();e.stopPropagation();}
return result;}
function propChange(originalEvent,boundElement,namespace){var lastEventInfo=document.documentElement[originalEvent.propertyName],triggeredElement=lastEventInfo.el;var boundCheckElement=boundElement;if(boundElement===document&&triggeredElement!==document){boundCheckElement=document.documentElement;}
if(triggeredElement!==undefined&&shoestring(triggeredElement).closest(boundCheckElement).length){originalEvent._namespace=lastEventInfo._namespace;originalEvent._args=lastEventInfo._args;encasedCallback.call(boundElement,originalEvent,namespace,triggeredElement);}}
return this.each(function(){var domEventCallback,customEventCallback,customEventLoop,oEl=this;for(var i=0,il=evts.length;i<il;i++){var split=evts[i].split("."),evt=split[0],namespace=split.length>0?split[1]:null;domEventCallback=function(originalEvent){if(oEl.ssEventTrigger){originalEvent._namespace=oEl.ssEventTrigger._namespace;originalEvent._args=oEl.ssEventTrigger._args;oEl.ssEventTrigger=null;}
return encasedCallback.call(oEl,originalEvent,namespace);};customEventCallback=null;customEventLoop=null;initEventCache(this,evt);if("addEventListener"in this){this.addEventListener(evt,domEventCallback,false);}else if(this.attachEvent){if(this["on"+evt]!==undefined){this.attachEvent("on"+evt,domEventCallback);}else{customEventCallback=(function(){var eventName=evt;return function(e){if(e.propertyName===eventName){propChange(e,oEl,namespace);}};})();if(this.shoestringData.events[evt].length===0){customEventLoop=(function(){var eventName=evt;return function(e){if(!oEl.shoestringData||!oEl.shoestringData.events){return;}
var events=oEl.shoestringData.events[eventName];if(!events){return;}
for(var j=0,k=events.length;j<k;j++){events[j].callback(e);}};})();docEl.attachEvent("onpropertychange",customEventLoop);}}}
addToEventCache(this,evt,{callfunc:customEventCallback||domEventCallback,isCustomEvent:!!customEventCallback,customEventLoop:customEventLoop,originalCallback:originalCallback,namespace:namespace});if(!customEventCallback){reorderEvents(oEl,evt);}}});};shoestring.fn.on=shoestring.fn.bind;shoestring.fn.unbind=function(event,callback){var evts=event?event.split(" "):[];return this.each(function(){if(!this.shoestringData||!this.shoestringData.events){return;}
if(!evts.length){unbindAll.call(this);}else{var split,evt,namespace;for(var i=0,il=evts.length;i<il;i++){split=evts[i].split("."),evt=split[0],namespace=split.length>0?split[1]:null;if(evt){unbind.call(this,evt,namespace,callback);}else{unbindAll.call(this,namespace,callback);}}}});};function unbind(evt,namespace,callback){var bound=this.shoestringData.events[evt];if(!(bound&&bound.length)){return;}
var matched=[],j,jl;for(j=0,jl=bound.length;j<jl;j++){if(!namespace||namespace===bound[j].namespace){if(callback===undefined||callback===bound[j].originalCallback){if("removeEventListener"in window){this.removeEventListener(evt,bound[j].callback,false);}else if(this.detachEvent){this.detachEvent("on"+evt,bound[j].callback);if(bound.length===1&&this.shoestringData.loop&&this.shoestringData.loop[evt]){document.documentElement.detachEvent("onpropertychange",this.shoestringData.loop[evt]);}}
matched.push(j);}}}
for(j=0,jl=matched.length;j<jl;j++){this.shoestringData.events[evt].splice(j,1);}}
function unbindAll(namespace,callback){for(var evtKey in this.shoestringData.events){unbind.call(this,evtKey,namespace,callback);}}
shoestring.fn.off=shoestring.fn.unbind;shoestring.fn.one=function(event,callback){var evts=event.split(" ");return this.each(function(){var thisevt,cbs={},$t=shoestring(this);for(var i=0,il=evts.length;i<il;i++){thisevt=evts[i];cbs[thisevt]=function(e){var $t=shoestring(this);for(var j in cbs){$t.unbind(j,cbs[j]);}
return callback.apply(this,[e].concat(e._args));};$t.bind(thisevt,cbs[thisevt]);}});};shoestring.fn.triggerHandler=function(event,args){var e=event.split(" ")[0],el=this[0],ret;if(document.createEvent&&el.shoestringData&&el.shoestringData.events&&el.shoestringData.events[e]){var bindings=el.shoestringData.events[e];for(var i in bindings){if(bindings.hasOwnProperty(i)){event=document.createEvent("Event");event.initEvent(e,true,true);event._args=args;args.unshift(event);ret=bindings[i].originalCallback.apply(event.target,args);}}}
return ret;};shoestring.fn.trigger=function(event,args){var evts=event.split(" ");return this.each(function(){var split,evt,namespace;for(var i=0,il=evts.length;i<il;i++){split=evts[i].split("."),evt=split[0],namespace=split.length>0?split[1]:null;if(evt==="click"){if(this.tagName==="INPUT"&&this.type==="checkbox"&&this.click){this.click();return false;}}
if(document.createEvent){var event=document.createEvent("Event");event.initEvent(evt,true,true);event._args=args;event._namespace=namespace;this.dispatchEvent(event);}else if(document.createEventObject){if((""+this[evt]).indexOf("function")>-1){this.ssEventTrigger={_namespace:namespace,_args:args};this[evt]();}else{document.documentElement[evt]={"el":this,_namespace:namespace,_args:args};}}}});};})(this);(function(factory){if(typeof define==='function'&&define.amd){define(['shoestring'],factory);}else if(typeof module==='object'&&module.exports){module.exports=function(root,shoestring){if(shoestring===undefined){if(typeof window!=='undefined'){shoestring=require('shoestring');}else{shoestring=require('shoestring')(root);}}
factory(shoestring);return shoestring;};}else{factory(shoestring);}}(function($){var Tablesaw,win=typeof window!=="undefined"?window:this;if(typeof Tablesaw==="undefined"){Tablesaw={i18n:{modes:['Stack','Swipe','Toggle'],columns:'Col<span class=\"a11y-sm\">umn</span>s',columnBtnText:'Columns',columnsDialogError:'No eligible columns.',sort:'Sort'},mustard:('querySelector'in document)&&('head'in document)&&(!window.blackberry||window.WebKitPoint)&&!window.operamini};}
if(!Tablesaw.config){Tablesaw.config={};}
if(Tablesaw.mustard){$(document.documentElement).addClass('tablesaw-enhanced');}
(function(){var pluginName="tablesaw",classes={toolbar:"tablesaw-bar"},events={create:"tablesawcreate",destroy:"tablesawdestroy",refresh:"tablesawrefresh"},defaultMode="stack",initSelector="table[data-tablesaw-mode],table[data-tablesaw-sortable]";var Table=function(element){if(!element){throw new Error("Tablesaw requires an element.");}
this.table=element;this.$table=$(element);this.mode=this.$table.attr("data-tablesaw-mode")||defaultMode;this.init();};Table.prototype.init=function(){if(!this.$table.attr("id")){this.$table.attr("id",pluginName+"-"+Math.round(Math.random()*10000));}
this.createToolbar();var colstart=this._initCells();this.$table.trigger(events.create,[this,colstart]);};Table.prototype._initCells=function(){var colstart,thrs=this.table.querySelectorAll("thead tr"),self=this;$(thrs).each(function(){var coltally=0;var children=$(this).children();var columnlookup=[];children.each(function(){var span=parseInt(this.getAttribute("colspan"),10);columnlookup[coltally]=this;colstart=coltally+1;if(span){for(var k=0;k<span-1;k++){coltally++;columnlookup[coltally]=this;}}
this.cells=[];coltally++;});self.$table.find("tr").not(thrs[0]).each(function(){var cellcoltally=0;$(this).children().each(function(){var span=parseInt(this.getAttribute("colspan"),10);columnlookup[cellcoltally].cells.push(this);if(span){cellcoltally+=span;}else{cellcoltally++;}});});});return colstart;};Table.prototype.refresh=function(){this._initCells();this.$table.trigger(events.refresh);};Table.prototype.createToolbar=function(){var $toolbar=this.$table.prev().filter('.'+classes.toolbar);if(!$toolbar.length){$toolbar=$('<div>').addClass(classes.toolbar).insertBefore(this.$table);}
this.$toolbar=$toolbar;if(this.mode){this.$toolbar.addClass('mode-'+this.mode);}};Table.prototype.destroy=function(){this.$table.prev().filter('.'+classes.toolbar).each(function(){this.className=this.className.replace(/\bmode\-\w*\b/gi,'');});var tableId=this.$table.attr('id');$(document).off("."+tableId);$(window).off("."+tableId);this.$table.trigger(events.destroy,[this]);this.$table.removeData(pluginName);};$.fn[pluginName]=function(){return this.each(function(){var $t=$(this);if($t.data(pluginName)){return;}
var table=new Table(this);$t.data(pluginName,table);});};$(document).on("enhance.tablesaw",function(e){if(Tablesaw.mustard){$(e.target).find(initSelector)[pluginName]();}});}());;(function(){var classes={stackTable:'tablesaw-stack',cellLabels:'tablesaw-cell-label',cellContentLabels:'tablesaw-cell-content'};var data={obj:'tablesaw-stack'};var attrs={labelless:'data-tablesaw-no-labels',hideempty:'data-tablesaw-hide-empty'};var Stack=function(element){this.$table=$(element);this.labelless=this.$table.is('['+attrs.labelless+']');this.hideempty=this.$table.is('['+attrs.hideempty+']');if(!this.labelless){this.allHeaders=this.$table.find("th");}
this.$table.data(data.obj,this);};Stack.prototype.init=function(colstart){this.$table.addClass(classes.stackTable);if(this.labelless){return;}
var reverseHeaders=$(this.allHeaders);var hideempty=this.hideempty;reverseHeaders.each(function(){var $t=$(this),$cells=$(this.cells).filter(function(){return!$(this).parent().is("["+attrs.labelless+"]")&&(!hideempty||!$(this).is(":empty"));}),hierarchyClass=$cells.not(this).filter("thead th").length&&" tablesaw-cell-label-top",$sortableButton=$t.find(".tablesaw-sortable-btn"),html=$sortableButton.length?$sortableButton.html():$t.html();if(html!==""){if(hierarchyClass){var iteration=parseInt($(this).attr("colspan"),10),filter="";if(iteration){filter="td:nth-child("+iteration+"n + "+(colstart)+")";}
$cells.filter(filter).prepend("<b class='"+classes.cellLabels+hierarchyClass+"'>"+html+"</b>");}else{$cells.wrapInner("<span class='"+classes.cellContentLabels+"'></span>");$cells.prepend("<b class='"+classes.cellLabels+"'>"+html+"</b>");}}});};Stack.prototype.destroy=function(){this.$table.removeClass(classes.stackTable);this.$table.find('.'+classes.cellLabels).remove();this.$table.find('.'+classes.cellContentLabels).each(function(){$(this).replaceWith(this.childNodes);});};$(document).on("tablesawcreate",function(e,tablesaw,colstart){if(tablesaw.mode==='stack'){var table=new Stack(tablesaw.table);table.init(colstart);}});$(document).on("tablesawdestroy",function(e,tablesaw){if(tablesaw.mode==='stack'){$(tablesaw.table).data(data.obj).destroy();}});}());}));;;(function($){$(function(){$(document).trigger("enhance.tablesaw");});})(shoestring||jQuery);;// DOM.event.move
//
// 2.0.0
//
// Stephen Band
//
// Triggers 'movestart', 'move' and 'moveend' events after
// mousemoves following a mousedown cross a distance threshold,
// similar to the native 'dragstart', 'drag' and 'dragend' events.
// Move events are throttled to animation frames. Move event objects
// have the properties:
//
// pageX:
// pageY:     Page coordinates of pointer.
// startX:
// startY:    Page coordinates of pointer at movestart.
// distX:
// distY:     Distance the pointer has moved since movestart.
// deltaX:
// deltaY:    Distance the finger has moved since last event.
// velocityX:
// velocityY: Average velocity over last few events.


(function(fn) {
	if (typeof define === 'function' && define.amd) {
        define([], fn);
    } else if ((typeof module !== "undefined" && module !== null) && module.exports) {
        module.exports = fn;
	} else {
		fn();
	}
})(function(){
	var assign = Object.assign || window.jQuery && jQuery.extend;

	// Number of pixels a pressed pointer travels before movestart
	// event is fired.
	var threshold = 8;

	// Shim for requestAnimationFrame, falling back to timer. See:
	// see http://paulirish.com/2011/requestanimationframe-for-smart-animating/
	var requestFrame = (function(){
		return (
			window.requestAnimationFrame ||
			window.webkitRequestAnimationFrame ||
			window.mozRequestAnimationFrame ||
			window.oRequestAnimationFrame ||
			window.msRequestAnimationFrame ||
			function(fn, element){
				return window.setTimeout(function(){
					fn();
				}, 25);
			}
		);
	})();

	var ignoreTags = {
			textarea: true,
			input: true,
			select: true,
			button: true
		};

	var mouseevents = {
		move:   'mousemove',
		cancel: 'mouseup dragstart',
		end:    'mouseup'
	};

	var touchevents = {
		move:   'touchmove',
		cancel: 'touchend',
		end:    'touchend'
	};

	var rspaces = /\s+/;


	// DOM Events

	var eventOptions = { bubbles: true, cancelable: true };

	var eventsSymbol = Symbol('events');

	function createEvent(type) {
		return new CustomEvent(type, eventOptions);
	}

	function getEvents(node) {
		return node[eventsSymbol] || (node[eventsSymbol] = {});
	}

	function on(node, types, fn, data, selector) {
		types = types.split(rspaces);

		var events = getEvents(node);
		var i = types.length;
		var handlers, type;

		function handler(e) { fn(e, data); }

		while (i--) {
			type = types[i];
			handlers = events[type] || (events[type] = []);
			handlers.push([fn, handler]);
			node.addEventListener(type, handler);
		}
	}

	function off(node, types, fn, selector) {
		types = types.split(rspaces);

		var events = getEvents(node);
		var i = types.length;
		var type, handlers, k;

		if (!events) { return; }

		while (i--) {
			type = types[i];
			handlers = events[type];
			if (!handlers) { continue; }
			k = handlers.length;
			while (k--) {
				if (handlers[k][0] === fn) {
					node.removeEventListener(type, handlers[k][1]);
					handlers.splice(k, 1);
				}
			}
		}
	}

	function trigger(node, type, properties) {
		// Don't cache events. It prevents you from triggering an event of a
		// given type from inside the handler of another event of that type.
		var event = createEvent(type);
		if (properties) { assign(event, properties); }
		node.dispatchEvent(event);
	}


	// Constructors
	
	function Timer(fn){
		var callback = fn,
		    active = false,
		    running = false;
		
		function trigger(time) {
			if (active){
				callback();
				requestFrame(trigger);
				running = true;
				active = false;
			}
			else {
				running = false;
			}
		}
		
		this.kick = function(fn) {
			active = true;
			if (!running) { trigger(); }
		};
		
		this.end = function(fn) {
			var cb = callback;
			
			if (!fn) { return; }
			
			// If the timer is not running, simply call the end callback.
			if (!running) {
				fn();
			}
			// If the timer is running, and has been kicked lately, then
			// queue up the current callback and the end callback, otherwise
			// just the end callback.
			else {
				callback = active ?
					function(){ cb(); fn(); } : 
					fn ;
				
				active = true;
			}
		};
	}


	// Functions

	function noop() {}
	
	function preventDefault(e) {
		e.preventDefault();
	}

	function isIgnoreTag(e) {
		return !!ignoreTags[e.target.tagName.toLowerCase()];
	}

	function isPrimaryButton(e) {
		// Ignore mousedowns on any button other than the left (or primary)
		// mouse button, or when a modifier key is pressed.
		return (e.which === 1 && !e.ctrlKey && !e.altKey);
	}

	function identifiedTouch(touchList, id) {
		var i, l;

		if (touchList.identifiedTouch) {
			return touchList.identifiedTouch(id);
		}
		
		// touchList.identifiedTouch() does not exist in
		// webkit yet… we must do the search ourselves...
		
		i = -1;
		l = touchList.length;
		
		while (++i < l) {
			if (touchList[i].identifier === id) {
				return touchList[i];
			}
		}
	}

	function changedTouch(e, data) {
		var touch = identifiedTouch(e.changedTouches, data.identifier);

		// This isn't the touch you're looking for.
		if (!touch) { return; }

		// Chrome Android (at least) includes touches that have not
		// changed in e.changedTouches. That's a bit annoying. Check
		// that this touch has changed.
		if (touch.pageX === data.pageX && touch.pageY === data.pageY) { return; }

		return touch;
	}


	// Handlers that decide when the first movestart is triggered
	
	function mousedown(e){
		// Ignore non-primary buttons
		if (!isPrimaryButton(e)) { return; }

		// Ignore form and interactive elements
		if (isIgnoreTag(e)) { return; }

		on(document, mouseevents.move, mousemove, e);
		on(document, mouseevents.cancel, mouseend, e);
	}

	function mousemove(e, data){
		checkThreshold(e, data, e, removeMouse);
	}

	function mouseend(e, data) {
		removeMouse();
	}

	function removeMouse() {
		off(document, mouseevents.move, mousemove);
		off(document, mouseevents.cancel, mouseend);
	}

	function touchstart(e) {
		// Don't get in the way of interaction with form elements
		if (ignoreTags[e.target.tagName.toLowerCase()]) { return; }

		var touch = e.changedTouches[0];

		// iOS live updates the touch objects whereas Android gives us copies.
		// That means we can't trust the touchstart object to stay the same,
		// so we must copy the data. This object acts as a template for
		// movestart, move and moveend event objects.
		var data = {
			target:     touch.target,
			pageX:      touch.pageX,
			pageY:      touch.pageY,
			identifier: touch.identifier,

			// The only way to make handlers individually unbindable is by
			// making them unique.
			touchmove:  function(e, data) { touchmove(e, data); },
			touchend:   function(e, data) { touchend(e, data); }
		};

		on(document, touchevents.move, data.touchmove, data);
		on(document, touchevents.cancel, data.touchend, data);
	}

	function touchmove(e, data) {
		var touch = changedTouch(e, data);
		if (!touch) { return; }
		checkThreshold(e, data, touch, removeTouch);
	}

	function touchend(e, data) {
		var touch = identifiedTouch(e.changedTouches, data.identifier);
		if (!touch) { return; }
		removeTouch(data);
	}

	function removeTouch(data) {
		off(document, touchevents.move, data.touchmove);
		off(document, touchevents.cancel, data.touchend);
	}

	function checkThreshold(e, data, touch, fn) {
		var distX = touch.pageX - data.pageX;
		var distY = touch.pageY - data.pageY;

		// Do nothing if the threshold has not been crossed.
		if ((distX * distX) + (distY * distY) < (threshold * threshold)) { return; }

		triggerStart(e, data, touch, distX, distY, fn);
	}

	function triggerStart(e, data, touch, distX, distY, fn) {
		var touches = e.targetTouches;
		var time = e.timeStamp - data.timeStamp;

		// Create a movestart object with some special properties that
		// are passed only to the movestart handlers.
		var template = {
			altKey:     e.altKey,
			ctrlKey:    e.ctrlKey,
			shiftKey:   e.shiftKey,
			startX:     data.pageX,
			startY:     data.pageY,
			distX:      distX,
			distY:      distY,
			deltaX:     distX,
			deltaY:     distY,
			pageX:      touch.pageX,
			pageY:      touch.pageY,
			velocityX:  distX / time,
			velocityY:  distY / time,
			identifier: data.identifier,
			targetTouches: touches,
			finger: touches ? touches.length : 1,
			enableMove: function() {
				this.moveEnabled = true;
				this.enableMove = noop;
				e.preventDefault();
			}
		};

		// Trigger the movestart event.
		trigger(data.target, 'movestart', template);

		// Unbind handlers that tracked the touch or mouse up till now.
		fn(data);
	}


	// Handlers that control what happens following a movestart

	function activeMousemove(e, data) {
		var timer  = data.timer;

		data.touch = e;
		data.timeStamp = e.timeStamp;
		timer.kick();
	}

	function activeMouseend(e, data) {
		var target = data.target;
		var event  = data.event;
		var timer  = data.timer;

		removeActiveMouse();

		endEvent(target, event, timer, function() {
			// Unbind the click suppressor, waiting until after mouseup
			// has been handled.
			setTimeout(function(){
				off(target, 'click', preventDefault);
			}, 0);
		});
	}

	function removeActiveMouse() {
		off(document, mouseevents.move, activeMousemove);
		off(document, mouseevents.end, activeMouseend);
	}

	function activeTouchmove(e, data) {
		var event = data.event;
		var timer = data.timer;
		var touch = changedTouch(e, event);

		if (!touch) { return; }

		// Stop the interface from gesturing
		e.preventDefault();

		event.targetTouches = e.targetTouches;
		data.touch = touch;
		data.timeStamp = e.timeStamp;

		timer.kick();
	}

	function activeTouchend(e, data) {
		var target = data.target;
		var event  = data.event;
		var timer  = data.timer;
		var touch  = identifiedTouch(e.changedTouches, event.identifier);

		// This isn't the touch you're looking for.
		if (!touch) { return; }

		removeActiveTouch(data);
		endEvent(target, event, timer);
	}

	function removeActiveTouch(data) {
		off(document, touchevents.move, data.activeTouchmove);
		off(document, touchevents.end, data.activeTouchend);
	}


	// Logic for triggering move and moveend events

	function updateEvent(event, touch, timeStamp) {
		var time = timeStamp - event.timeStamp;

		event.distX =  touch.pageX - event.startX;
		event.distY =  touch.pageY - event.startY;
		event.deltaX = touch.pageX - event.pageX;
		event.deltaY = touch.pageY - event.pageY;
		
		// Average the velocity of the last few events using a decay
		// curve to even out spurious jumps in values.
		event.velocityX = 0.3 * event.velocityX + 0.7 * event.deltaX / time;
		event.velocityY = 0.3 * event.velocityY + 0.7 * event.deltaY / time;
		event.pageX =  touch.pageX;
		event.pageY =  touch.pageY;
	}

	function endEvent(target, event, timer, fn) {
		timer.end(function(){
			trigger(target, 'moveend', event);
			return fn && fn();
		});
	}


	// Set up the DOM

	function movestart(e) {
		if (e.defaultPrevented) { return; }
		if (!e.moveEnabled) { return; }

		var event = {
			startX:        e.startX,
			startY:        e.startY,
			pageX:         e.pageX,
			pageY:         e.pageY,
			distX:         e.distX,
			distY:         e.distY,
			deltaX:        e.deltaX,
			deltaY:        e.deltaY,
			velocityX:     e.velocityX,
			velocityY:     e.velocityY,
			identifier:    e.identifier,
			targetTouches: e.targetTouches,
			finger:        e.finger
		};

		var data = {
			target:    e.target,
			event:     event,
			timer:     new Timer(update),
			touch:     undefined,
			timeStamp: e.timeStamp
		};

		function update(time) {
			updateEvent(event, data.touch, data.timeStamp);
			trigger(data.target, 'move', event);
		}

		if (e.identifier === undefined) {
			// We're dealing with a mouse event.
			// Stop clicks from propagating during a move
			on(e.target, 'click', preventDefault);
			on(document, mouseevents.move, activeMousemove, data);
			on(document, mouseevents.end, activeMouseend, data);
		}
		else {
			// In order to unbind correct handlers they have to be unique
			data.activeTouchmove = function(e, data) { activeTouchmove(e, data); };
			data.activeTouchend = function(e, data) { activeTouchend(e, data); };

			// We're dealing with a touch.
			on(document, touchevents.move, data.activeTouchmove, data);
			on(document, touchevents.end, data.activeTouchend, data);
		}
	}

	on(document, 'mousedown', mousedown);
	on(document, 'touchstart', touchstart);
	on(document, 'movestart', movestart);


	// jQuery special events
	//
	// jQuery event objects are copies of DOM event objects. They need
	// a little help copying the move properties across.

	if (!window.jQuery) { return; }

	var properties = ("startX startY pageX pageY distX distY deltaX deltaY velocityX velocityY").split(' ');

	function enableMove1(e) { e.enableMove(); }
	function enableMove2(e) { e.enableMove(); }
	function enableMove3(e) { e.enableMove(); }

	function add(handleObj) {
		var handler = handleObj.handler;

		handleObj.handler = function(e) {
			// Copy move properties across from originalEvent
			var i = properties.length;
			var property;

			while(i--) {
				property = properties[i];
				e[property] = e.originalEvent[property];
			}

			handler.apply(this, arguments);
		};
	}

	jQuery.event.special.movestart = {
		setup: function() {
			// Movestart must be enabled to allow other move events
			on(this, 'movestart', enableMove1);

			// Do listen to DOM events
			return false;
		},

		teardown: function() {
			off(this, 'movestart', enableMove1);
			return false;
		},

		add: add
	};

	jQuery.event.special.move = {
		setup: function() {
			on(this, 'movestart', enableMove2);
			return false;
		},

		teardown: function() {
			off(this, 'movestart', enableMove2);
			return false;
		},

		add: add
	};

	jQuery.event.special.moveend = {
		setup: function() {
			on(this, 'movestart', enableMove3);
			return false;
		},

		teardown: function() {
			off(this, 'movestart', enableMove3);
			return false;
		},

		add: add
	};
});
;/**/
(function(thisModule){if(typeof define==='function'&&define.amd){define(['jquery',undefined,'jquery.event.move'],thisModule);}else if((typeof module!=="undefined"&&module!==null)&&module.exports){module.exports=thisModule;}else{thisModule(jQuery);}})(function(jQuery,undefined){var add=jQuery.event.add,remove=jQuery.event.remove,trigger=function(node,type,data){jQuery.event.trigger(type,data,node);},settings={threshold:0.4,sensitivity:6};function moveend(e){var w,h,event;w=e.currentTarget.offsetWidth;h=e.currentTarget.offsetHeight;event={distX:e.distX,distY:e.distY,velocityX:e.velocityX,velocityY:e.velocityY,finger:e.finger};if(e.distX>e.distY){if(e.distX>-e.distY){if(e.distX/w>settings.threshold||e.velocityX*e.distX/w*settings.sensitivity>1){event.type='swiperight';trigger(e.currentTarget,event);}}
else{if(-e.distY/h>settings.threshold||e.velocityY*e.distY/w*settings.sensitivity>1){event.type='swipeup';trigger(e.currentTarget,event);}}}
else{if(e.distX>-e.distY){if(e.distY/h>settings.threshold||e.velocityY*e.distY/w*settings.sensitivity>1){event.type='swipedown';trigger(e.currentTarget,event);}}
else{if(-e.distX/w>settings.threshold||e.velocityX*e.distX/w*settings.sensitivity>1){event.type='swipeleft';trigger(e.currentTarget,event);}}}}
function getData(node){var data=jQuery.data(node,'event_swipe');if(!data){data={count:0};jQuery.data(node,'event_swipe',data);}
return data;}
jQuery.event.special.swipe=jQuery.event.special.swipeleft=jQuery.event.special.swiperight=jQuery.event.special.swipeup=jQuery.event.special.swipedown={setup:function(data,namespaces,eventHandle){var data=getData(this);if(data.count++>0){return;}
add(this,'moveend',moveend);return true;},teardown:function(){var data=getData(this);if(--data.count>0){return;}
remove(this,'moveend',moveend);return true;},settings:settings};});;(function($){Drupal.behaviors.colorbox_swipe={attach:function(context,settings){$(document).ready(function(){$("#colorbox *",context).bind('swipeleft',function(e){$(this).disableSelection();$.colorbox.next();}).bind('swiperight',function(e){$(this).disableSelection();$.colorbox.prev();});});}}})(jQuery);;