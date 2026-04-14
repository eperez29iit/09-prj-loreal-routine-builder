/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineButton = document.getElementById("generateRoutine");
const clearSelectionsButton = document.getElementById("clearSelections");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");

let allProducts = [];
let selectedProductIds = [];
let chatHistory = [];

const workerURL = "https://sweet-king-182a.manolo596perez.workers.dev/";

function loadSelectedProducts() {
  const saved = localStorage.getItem("selectedProductIds");
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function saveSelectedProducts() {
  localStorage.setItem(
    "selectedProductIds",
    JSON.stringify(selectedProductIds),
  );
}

function getProductById(id) {
  return allProducts.find((product) => product.id === Number(id));
}

function createProductCard(product) {
  const isSelected = selectedProductIds.includes(product.id);
  return `
    <article class="product-card ${isSelected ? "selected" : ""}" data-product-id="${product.id}" tabindex="0">
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <p>${product.brand}</p>
        <h3>${product.name}</h3>
        <button type="button" class="details-toggle">
          Details <span class="chevron">+</span>
        </button>
        <div class="description-panel">
          <p>${product.description}</p>
        </div>
      </div>
    </article>
  `;
}

function renderProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match this category yet.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products.map(createProductCard).join("");

  productsContainer.querySelectorAll(".product-card").forEach((card) => {
    const productId = card.dataset.productId;
    card.addEventListener("click", () => toggleProductSelection(productId));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleProductSelection(productId);
      }
    });

    const detailsButton = card.querySelector(".details-toggle");
    const descriptionPanel = card.querySelector(".description-panel");

    detailsButton.addEventListener("click", (event) => {
      event.stopPropagation();
      card.classList.toggle("show-details");
      const isOpen = card.classList.contains("show-details");
      detailsButton.setAttribute("aria-expanded", isOpen);
    });
  });
}

function renderSelectedProducts() {
  const products = selectedProductIds.map(getProductById).filter(Boolean);

  if (!products.length) {
    selectedProductsList.innerHTML = `
      <p class="placeholder-message">Pick a few products to build your custom routine.</p>
    `;
    generateRoutineButton.disabled = true;
    return;
  }

  generateRoutineButton.disabled = false;
  selectedProductsList.innerHTML = products
    .map(
      (product) => `
      <div class="selected-item">
        <div>
          <strong>${product.name}</strong>
          <small>${product.brand} • ${product.category}</small>
        </div>
        <button type="button" class="remove-item-btn" data-product-id="${product.id}" aria-label="Remove ${product.name}">
          &times;
        </button>
      </div>
    `,
    )
    .join("");

  selectedProductsList
    .querySelectorAll(".remove-item-btn")
    .forEach((button) => {
      button.addEventListener("click", (event) => {
        const productId = event.currentTarget.dataset.productId;
        event.stopPropagation();
        removeSelectedProduct(productId);
      });
    });
}

async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

function updateSelectionButtons() {
  generateRoutineButton.disabled = selectedProductIds.length === 0;
}

function toggleProductSelection(productId) {
  const id = Number(productId);
  if (selectedProductIds.includes(id)) {
    selectedProductIds = selectedProductIds.filter((itemId) => itemId !== id);
  } else {
    selectedProductIds.push(id);
  }

  saveSelectedProducts();
  renderSelectedProducts();
  filterProducts(categoryFilter.value);
}

function removeSelectedProduct(productId) {
  const id = Number(productId);
  selectedProductIds = selectedProductIds.filter((itemId) => itemId !== id);
  saveSelectedProducts();
  renderSelectedProducts();
  filterProducts(categoryFilter.value);
}

function clearSelectedProducts() {
  selectedProductIds = [];
  saveSelectedProducts();
  renderSelectedProducts();
  filterProducts(categoryFilter.value);
}

function getFilteredProducts(category) {
  if (!category || category === "all") {
    return allProducts;
  }
  return allProducts.filter((product) => product.category === category);
}

function filterProducts(category) {
  const filtered = getFilteredProducts(category);
  renderProducts(filtered);
  return filtered;
}

function displayChatMessage(role, text) {
  const messageEl = document.createElement("div");
  messageEl.className = `chat-message ${role}`;
  messageEl.textContent = text;
  chatWindow.appendChild(messageEl);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function setChatPlaceholder() {
  chatWindow.innerHTML = "";
  displayChatMessage(
    "ai",
    "Welcome! Select products and tap Generate Routine to get a personalized beauty plan. Then ask follow-up questions anytime.",
  );
}

function buildSystemMessage() {
  return {
    role: "system",
    content:
      "You are a helpful beauty advisor. Answer only questions about skincare, haircare, makeup, fragrance, routines, or the user's selected products. Avoid unrelated topics. Keep responses friendly, clear, and practical.",
  };
}

async function openAIRequest(messages) {
  if (!workerURL || workerURL === "YOUR_WORKER_URL") {
    throw new Error(
      "Cloudflare worker URL is not configured. Set workerURL at the top of script.js.",
    );
  }

  const response = await fetch(workerURL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || "Worker request failed.");
  }

  return (
    data.response?.trim() ||
    data.result?.trim() ||
    data.choices?.[0]?.message?.content?.trim() ||
    "I couldn't generate a response right now."
  );
}

function buildRoutinePrompt(products) {
  const productDetails = products
    .map(
      (product) =>
        `- ${product.brand} ${product.name} (${product.category}): ${product.description}`,
    )
    .join("\n");

  return `Create a personalized beauty routine using only the selected products below. Include how and when each product should be used, the best order for morning and evening if relevant, and what skin or hair goal each product supports. Keep the tone warm, elegant, and helpful.

Selected products:
${productDetails}`;
}

async function handleGenerateRoutine() {
  const selectedProducts = selectedProductIds
    .map(getProductById)
    .filter(Boolean);
  if (!selectedProducts.length) {
    displayChatMessage(
      "ai",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  const prompt = buildRoutinePrompt(selectedProducts);
  displayChatMessage("user", "Create a routine for the selected products.");

  const routineMessage = { role: "user", content: prompt };
  chatHistory.push(routineMessage);

  try {
    displayChatMessage("ai", "Generating your routine... Please wait.");
    const assistantResponse = await openAIRequest([
      buildSystemMessage(),
      ...chatHistory,
    ]);
    chatHistory.push({ role: "assistant", content: assistantResponse });
    chatWindow.lastElementChild.textContent = assistantResponse;
  } catch (error) {
    chatWindow.lastElementChild.textContent =
      "Unable to generate routine. " + error.message;
  }
}

async function handleChatSubmit(event) {
  event.preventDefault();
  const message = userInput.value.trim();
  if (!message) return;

  displayChatMessage("user", message);
  chatHistory.push({ role: "user", content: message });
  userInput.value = "";

  try {
    displayChatMessage("ai", "Reading your question and responding... ");
    const messages = [buildSystemMessage(), ...chatHistory];
    const assistantResponse = await openAIRequest(messages);
    chatHistory.push({ role: "assistant", content: assistantResponse });
    chatWindow.lastElementChild.textContent = assistantResponse;
  } catch (error) {
    chatWindow.lastElementChild.textContent =
      "Unable to answer right now. " + error.message;
  }
}

async function initApp() {
  selectedProductIds = loadSelectedProducts();
  allProducts = await loadProducts();
  renderSelectedProducts();
  filterProducts(categoryFilter.value);
  setChatPlaceholder();
}

categoryFilter.addEventListener("change", () => {
  filterProducts(categoryFilter.value);
});

generateRoutineButton.addEventListener("click", handleGenerateRoutine);
clearSelectionsButton.addEventListener("click", clearSelectedProducts);
chatForm.addEventListener("submit", handleChatSubmit);

document.addEventListener("DOMContentLoaded", initApp);
