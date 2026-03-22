import { createElement, addNewElement, insertElement, formatElement } from "./dom-helper.mjs";
import { renderNavBar } from "./landing-page.mjs";

const root = document.getElementById("root");
const policyFilePath = "./docs/privacy-policy.json";

export async function renderPrivacyPage() {
  root.innerHTML = "";
  renderNavBar(root);

  const wrapper = createElement("div", ["page-wrapper"]);
  const card = createElement("section", ["privacy-card"]);
  const controls = createElement("div", ["privacy-controls"]);
  const enBtn = createElement("button", ["btn-small"], "English");
  const svBtn = createElement("button", ["btn-small"], "Svenska");
  const content = createElement("article", ["privacy-content"]);

  insertElement(root, wrapper);
  insertElement(wrapper, card);
  insertElement(card, controls);
  insertElement(controls, enBtn);
  insertElement(controls, svBtn);
  insertElement(card, content);

  let policyData;

  const renderLang = (lang) => {
    const languagePolicy = policyData?.languages?.[lang];
    if (!languagePolicy) {
      throw new Error(`Language '${lang}' not found in privacy policy.`);
    }

    renderPolicyContent(content, languagePolicy);
    enBtn.disabled = lang === "en";
    svBtn.disabled = lang === "sv";
  };

  enBtn.addEventListener("click", () => {
    try {
      renderLang("en");
    } catch {
      content.textContent = "Could not load privacy policy.";
    }
  });

  svBtn.addEventListener("click", () => {
    try {
      renderLang("sv");
    } catch {
      content.textContent = "Kunde inte ladda integritetspolicyn.";
    }
  });

  try {
    const response = await fetch(policyFilePath);
    if (!response.ok) {
      throw new Error(`Could not load ${policyFilePath}`);
    }

    policyData = await response.json();
    const defaultLanguage = policyData.defaultLanguage || "en";
    renderLang(defaultLanguage);

    const englishLabel = policyData?.languages?.en?.buttonLabel || "English";
    const swedishLabel = policyData?.languages?.sv?.buttonLabel || "Svenska";
    formatElement(enBtn, {backgroundColor: "white"}, ["primary-color"], { textContent: englishLabel });
    formatElement(svBtn, {backgroundColor: "white"}, ["primary-color"], { textContent: swedishLabel });
  } catch {
    content.textContent = "Could not load privacy policy.";
  }
}

function renderPolicyContent(container, languagePolicy) {
  container.replaceChildren();

  const title = createElement("h2", [], languagePolicy.title || "Privacy Policy");
  insertElement(container, title);

  const updatedText = `${languagePolicy.lastUpdatedLabel || "Last updated"}: ${languagePolicy.updatedAt || "-"}`;
  const updatedAt = createElement("p", [], updatedText);
  insertElement(container, updatedAt);

  languagePolicy.sections?.forEach((section, index) => {
    const sectionWrap = createElement("section", ["privacy-section"]);
    const heading = createElement("h3", [], `${index + 1}. ${section.heading}`);

    insertElement(container, sectionWrap);
    insertElement(sectionWrap, heading);

    section.paragraphs?.forEach((paragraph) => {
      const paragraphEl = createElement("p", [], paragraph);
      insertElement(sectionWrap, paragraphEl);
    });

    if (section.bullets?.length) {
      const list = createElement("ul", []);
      insertElement(sectionWrap, list);

      section.bullets.forEach((bullet) => {
        const item = createElement("li", [], bullet);
        insertElement(list, item);
      });
    }

    section.additionalParagraphs?.forEach((paragraph) => {
      const paragraphEl = createElement("p", [], paragraph);
      insertElement(sectionWrap, paragraphEl);
    });
  });

  if (languagePolicy.footnotes?.length) {
      addNewElement(container, "hr");


    languagePolicy.footnotes.forEach((footnote) => {
      const footnoteText = `${footnote.marker} ${footnote.text}`;
      const note = createElement("p", [], footnoteText);
      insertElement(container, note);
      insertElement(container, createElement("br"));
    });
  }
}