const LOCAL_STORAGE_KEY_PLACES = "places";
const QUERY_PARAM_PLACES = "places";
const QUERY_PARAM_MAP = "map";
const QUERY_PARAM_MAP_DEFAULT = "countries";
const PLACES_SEPARATOR_SYMBOL = ".";
const MAP_FILE = new URL(window.location.href).searchParams.get(QUERY_PARAM_MAP) || QUERY_PARAM_MAP_DEFAULT;
const CONFIG = JSON.parse(document.getElementById("config").textContent);
const tr = (stringKey, params = {}) => {
  let string = CONFIG[MAP_FILE].strings[stringKey] || "";

  for (const param of Object.keys(params)) {
    string = string.replace(`$${param.toUpperCase()}$`, params[param]);
  }

  return string;
};
const map = L.map("map").setView([50, 15], 5);
const updateLocalStorage = (places) => {
  localStorage.setItem(`${MAP_FILE}_${LOCAL_STORAGE_KEY_PLACES}`, places);
};
const getRelativeUrl = (path) => {
  const url = new URL(window.location.href);

  if (/\/$/.test(url.pathname)) {
    url.pathname += path;
  } else {
    url.pathname.replace(/(.*)\/.*?$/, "$1/" + path);
  }

  return url.toString();
};

const places = (() => {
  const searchParams = new URL(window.location.href).searchParams;
  const placesFromUrl = searchParams.get(`${MAP_FILE}_${QUERY_PARAM_PLACES}`) || searchParams.get(QUERY_PARAM_PLACES);
  let places = null;

  if (placesFromUrl) {
    updateLocalStorage(placesFromUrl);
    places = placesFromUrl;
  } else {
    places = localStorage.getItem(`${MAP_FILE}_${LOCAL_STORAGE_KEY_PLACES}`) || localStorage.getItem(LOCAL_STORAGE_KEY_PLACES);
  }

  return places ? places.split(PLACES_SEPARATOR_SYMBOL) : [];
})();
const updateUrl = (mapFile, places) => {
  const urlObj = new URL(document.location);

  if (places) {
    urlObj.searchParams.set(`${MAP_FILE}_${QUERY_PARAM_PLACES}`, places);
  } else {
    urlObj.searchParams.delete(`${MAP_FILE}_${QUERY_PARAM_PLACES}`);
  }

  urlObj.searchParams.delete(QUERY_PARAM_PLACES);
  urlObj.searchParams.set(QUERY_PARAM_MAP, mapFile);

  window.history.pushState({ path: urlObj.href }, "", urlObj.href);
};
const prepareStrings = (places) => {
  const count = places.length;
  const label =
    count === 1
      ? tr("one_place")
      : count === 0
      ? tr("no_places")
      : tr("visited_many_places", { count });
  const title = label;
  const descr = tr("share_message", { count, places: places.sort().join(", ") });

  return {
    title,
    label,
    descr,
  };
};
const updateDynamicContent = ({ title, label, descr }) => {
  document.title = title;

  document.querySelector('meta[property="description"]').content = descr;
  document.querySelector('meta[property="og:title"]').content = title;
  document.querySelector('meta[property="og:description"]').content = descr;
  document.querySelector('meta[property="og:image"]').content = getRelativeUrl(
    "images/sharable.jpg"
  );

  if (document.querySelector("#cc-been-to")) {
    document.querySelector("#cc-been-to").innerHTML = label;
  }

  const link = document.querySelector("#cc-share-copy-input");

  link.value = window.location.href;

  const fb = document.querySelector("#cc-share-facebook");
  const tw = document.querySelector("#cc-share-twitter");
  const li = document.querySelector("#cc-share-linkedin");
  const wa = document.querySelector("#cc-share-whatsapp");
  const tl = document.querySelector("#cc-share-telegram");

  const fbUrl = new URL(fb.href);
  fbUrl.searchParams.set("url", window.location.href);
  fb.href = fbUrl.toString();

  const twUrl = new URL(tw.href);
  twUrl.searchParams.set("text", descr);
  twUrl.searchParams.set("url", window.location.href);
  tw.href = twUrl.toString();

  const liUrl = new URL(li.href);
  liUrl.searchParams.set("title", title);
  liUrl.searchParams.set("summary", descr);
  liUrl.searchParams.set("url", window.location.href);
  liUrl.searchParams.set("source", window.location.origin);
  li.href = liUrl.toString();

  const waUrl = new URL(wa.href);
  liUrl.searchParams.set("text", `${title} ${window.location.href}`);
  wa.href = waUrl.toString();

  const tlUrl = new URL(tl.href);
  tlUrl.searchParams.set("text", descr);
  tlUrl.searchParams.set("url", window.location.href);
  tl.href = tlUrl.toString();
};

document.querySelector('meta[property="description"]').content =
  tr("description");
document.querySelector('meta[property="og:title"]').content = tr("title");
document.querySelector('meta[property="og:description"]').content =
  tr("description");

document.querySelector("#cc-share-title").innerText = tr("share_title");
document.querySelector("#cc-share-body").innerText = tr("share_body");
document.querySelector("#cc-share-copy-btn").innerText = tr("share_copy_btn");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

((L) => {
  L.Control.Share = L.Control.extend({
    $container: document.createElement("div"),
    $dialog: document.querySelector("#cc-dialog"),
    $dialogCloseBtn: document.querySelector("#cc-dialog-close-btn"),
    $copyInput: document.querySelector("#cc-share-copy-input"),
    $copyBtn: document.querySelector("#cc-share-copy-btn"),

    onShareButtonClick() {
      if (this.$dialog.showModal) {
        this.$dialog.showModal();
      } else {
        alert(`Share this link with your friends:\n${window.location.href}`);
      }
    },

    onCopyButtonClick() {
      this.$copyInput.select();
      this.$copyInput.setSelectionRange(0, 99999); /*For mobile devices*/

      /* Copy the text inside the text field */
      document.execCommand("copy");
    },

    onAdd(map) {
      this.$container.innerHTML = `<button type="button" id="cc-share" class="btn">${tr(
        "share_share_btn"
      )}</button>`;
      this.$share = this.$container.querySelector("#cc-share");
      this.$share.addEventListener("click", (event) =>
        this.onShareButtonClick()
      );
      this.$copyBtn.addEventListener("click", (event) =>
        this.onCopyButtonClick(event)
      );
      this.$dialogCloseBtn.addEventListener("click", (event) =>
        this.$dialog.close()
      );

      return this.$container;
    },
  });

  L.Control.Places = L.Control.extend({
    // set of the currently selected places
    placeIds: new Set(),

    // geojson layer containing the places polygons
    placesLayer: null,

    // map file name
    mapFile: null,

    // main container of the control
    $control: document.createElement("div"),

    // search box input
    $search: null,

    // toggle button
    $toggleBtn: null,

    // list items of countries
    $listItems: null,

    get minCharsToSearch() {
      return this.options.minCharsToSearch || 1;
    },

    onAdd(map) {
      const { geojson, geojsonStyle, mapFile, places = [] } = this.options;

      places.map((place) => this.placeIds.add(place));
      // TODO ugly workaround, but I'm too lazy to fix it :(
      setTimeout(() => {
        this.fire("placesChanged", {
          mapFile: MAP_FILE,
          places: places.join(PLACES_SEPARATOR_SYMBOL),
        });
      });

      this.placesLayer = L.geoJSON(geojson, {
        style: (f) => {
          if (typeof geojsonStyle === "function") {
            return geojsonStyle(f, this);
          } else {
            return geojsonStyle;
          }
        },
        onEachFeature: (f, l) => {
          l.on("click", (event) => this.onFeatureClick(event, f, l));
          this.on("placeChanged", () =>
            l.setStyle(this.options.geojsonStyle(f, this))
          );
        },
      }).addTo(map);

      this.$control.addEventListener("click", (event) =>
        event.stopPropagation()
      );
      this.$control.addEventListener("wheel", (event) =>
        event.stopPropagation()
      );
      this.$control.addEventListener("dblclick", (event) =>
        event.stopPropagation()
      );

      this.render(map, geojson);

      return this.$control;
    },

    render(map, places) {
      const $tmplControl = document.querySelector("#tmpl-control-places");
      const $control = document.importNode($tmplControl.content, true);
      const $list = $control.querySelector("#cc-list");

      this.$control.appendChild($control);

      for (const place of places.features) {
        const $li = document.createElement("li");
        const $label = document.createElement("label");
        const $checkbox = document.createElement("input");

        $label.appendChild($checkbox);

        $checkbox.type = "checkbox";
        $checkbox.value = place.properties.id;
        $checkbox.autocomplete = "off";

        $label.innerHTML += place.properties.name;
        // TODO one day I should support subdivisions of the countries
        // $label.innerHTML += '<span class="pull-left">unity|regions</span>';

        $label.addEventListener("change", (event) =>
          this.onPlaceCheckboxChanged(event)
        );

        $li.appendChild($label);
        $list.appendChild($li);
      }

      this.$listItems = this.$control.querySelectorAll("#cc-list > li");
      this.$search = this.$control.querySelector("#cc-search");
      this.$toggleBtn = this.$control.querySelector("#cc-toggle-btn");

      this.$search.placeholder = tr("search_placeholder");

      this.$toggleBtn.addEventListener("click", (event) =>
        this.onToggleBtnClick(event)
      );
      this.$search.addEventListener("keydown", (event) =>
        this.onSearchInputKeydown(event)
      );
      this.$search.addEventListener("input", (event) =>
        this.onSearchInput(event)
      );
      // BUG WORKAROUND: this does not work if I use $checkbox.addEventListener in the loop above, no idea why...
      this.$control
        .querySelectorAll('input[type="checkbox"]')
        .forEach(($input) => {
          $input.checked = this.hasPlace($input.value);
          $input.addEventListener("focus", ({ target }) =>
            target.closest("li").classList.add("active")
          );
          $input.addEventListener("blur", ({ target }) =>
            target.closest("li").classList.remove("active")
          );
          $input.addEventListener("keydown", (event) =>
            this.onCheckboxKeydown(event)
          );
        });
    },

    onPlaceCheckboxChanged({ target }) {
      this.togglePlace(target.value);
    },

    onSearchInput({ target }) {
      this.resetSearch();

      if (target.value < this.minCharsToSearch) return;
      if (!this.$listItems) return;

      const re = RegExp(target.value, "i");

      this.$listItems.forEach(($li) => {
        $li.hidden = !re.test($li.innerText);
      });
    },

    onToggleBtnClick(event) {
      const { target } = event;
      const toggled = target.dataset.toggled === "0";

      target.dataset.toggled = +toggled;

      if (toggled) {
        target.innerHTML = "+";
      } else {
        target.innerHTML = "-";
      }

      this.$control.classList.toggle("collapsed", toggled);
    },

    onSearchInputKeydown(event) {
      const { target, key } = event;
      const checkboxes = [...this.$listItems].find(($li) => !$li.hidden);

      if (!checkboxes) return;

      const $firstVisibleCheckbox = checkboxes.querySelector('input[type="checkbox"]');

      if (key === "ArrowDown") {
        event.preventDefault();

        $firstVisibleCheckbox.focus();
      } else if (key === "Enter") {
        $firstVisibleCheckbox.checked = !$firstVisibleCheckbox.checked;

        this.togglePlace($firstVisibleCheckbox.value);
        event.preventDefault();
      } else {
        // do nothing
      }
    },

    onCheckboxKeydown(event) {
      const { target, key } = event;

      if (key === "ArrowDown") {
        event.preventDefault();

        const sibling = this.nextVisibleSibling(
          target.closest("li"),
          target.closest("ul").querySelectorAll("li")
        );

        if (sibling) {
          sibling.querySelector("input").focus();
        } else {
          this.$search.focus();
        }
      } else if (key === "ArrowUp") {
        event.preventDefault();

        const sibling = this.previousVisibleSibling(
          target.closest("li"),
          target.closest("ul").querySelectorAll("li")
        );

        if (sibling) {
          sibling.querySelector("input").focus();
        } else {
          this.$search.focus();
        }
      } else if (key === "Escape" || key === "Backspace") {
        this.$search.focus();
      } else if (key === "Enter") {
        target.click();
      } else {
        // do nothing
      }
    },

    onFeatureClick(event, f, l) {
      const placeId = f.properties.id;

      this.togglePlace(placeId);
    },

    resetSearch() {
      this.$listItems.forEach(($li) => ($li.hidden = false));
    },

    nextVisibleSibling(target, els) {
      let sibling = target;

      while (sibling) {
        sibling = sibling.nextSibling;

        if (sibling && !sibling.hidden) break;
      }

      if (!sibling) {
        sibling = [...els].find((el) => !el.hidden);
      }

      return sibling;
    },

    previousVisibleSibling(target, els) {
      let sibling = target;

      while (sibling) {
        sibling = sibling.previousSibling;

        if (sibling && !sibling.hidden) break;
      }

      if (!sibling) {
        sibling = [...els].reverse().find((el) => !el.hidden);
      }

      return sibling;
    },

    updateCheckboxChecked(placeId, isChecked) {
      if (!this.$listItems) return;

      this.$listItems.forEach(($li) => {
        const $checkbox = $li.querySelector(`input[value="${placeId}"]`);

        if (!$checkbox) return;

        $checkbox.checked = isChecked;
      });
    },

    togglePlace(placeId, toggled) {
      if (typeof toggled !== "boolean") {
        toggled = !this.hasPlace(placeId);
      }

      if (toggled) {
        this.placeIds.add(placeId);
      } else {
        this.placeIds.delete(placeId);
      }

      this.updateCheckboxChecked(placeId, toggled);

      const places = this.getPlaceIds().join(PLACES_SEPARATOR_SYMBOL);
      const mapFile = MAP_FILE;

      this.fire("placeChanged", { mapFile, placeId, toggled });
      this.fire("placesChanged", { mapFile, places });

      return toggled;
    },

    hasPlace(placeId) {
      return this.placeIds.has(placeId);
    },

    getPlaceIds() {
      return [...this.placeIds.values()];
    },

    getPlaces() {
      return this.options.geojson.features
        .filter((f) => this.hasPlace(f.properties.id))
        .map((f) => f.properties.name);
    },
  });

  L.extend(L.Control.Places.prototype, L.Evented.prototype);

  L.control.places = function (opts) {
    return new L.Control.Places(opts);
  };

  L.control.share = function (opts) {
    return new L.Control.Share(opts);
  };
})(L);

const start = async () => {
  const geojson = await fetch(`./data/${MAP_FILE}.geojson`).then((r) => r.json());

  const placesControl = L.control.places({
    position: "topright",
    geojsonStyle: (f, plugin) => {
      return {
        fillColor: plugin.hasPlace(f.properties.id)
          ? "rgba(0, 180, 0, 0.5)"
          : "transparent",
        weight: 2,
        opacity: 1,
        color: "#333",
        dashArray: "3",
        fillOpacity: 0.7,
      };
    },
    mapFile: MAP_FILE,
    places,
    geojson,
  });

  const shareControl = L.control
    .share({
      position: "topright",
    })
    .addTo(map);

  placesControl
    .on("placesChanged", ({ mapFile, places }) => {
      const strings = prepareStrings(placesControl.getPlaces());

      updateUrl(mapFile, places);
      updateLocalStorage(places);
      updateDynamicContent(strings);
    })
    .addTo(map);
};

start().catch((err) => {
  console.log(err);
  alert(
    "Unfortunately the page encountered an error. Please file a github issue at https://github.com/suricactus/i-have-been-to ."
  );
});
