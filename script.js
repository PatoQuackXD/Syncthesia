const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultsDiv = document.getElementById("results");
const submitBtn = document.getElementById("submitBtn");
const confirmacao = document.getElementById("confirmacao");

let selectedVideo = null;
let selectedTitle = null;

function buscarMusica() {
  const query = searchInput.value.trim();
  if (query.length < 2) {
    resultsDiv.innerHTML = "Digite pelo menos 2 letras.";
    return;
  }

  searchBtn.disabled = true;
  resultsDiv.innerHTML = "Buscando...";

  fetch(`https://meu-backend-jf73.onrender.com/buscar?q=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      resultsDiv.innerHTML = "";

      if (data.error) {
        console.error("Erro da API do YouTube:", data.error);
        resultsDiv.innerHTML = "Não foi possível buscar agora (" + data.error.message + "). Tenta de novo em alguns minutos.";
        return;
      }

      if (!data.items || data.items.length === 0) {
        resultsDiv.innerHTML = "Nenhum resultado encontrado.";
        return;
      }

      data.items.forEach(item => {
        const videoId = item.id.videoId;
        const title = item.snippet.title;
        const thumbnail = item.snippet.thumbnails.default.url;

        const div = document.createElement("div");
        div.classList.add("video");
        div.innerHTML = `
          <img src="${thumbnail}" alt="thumb">
          <span class="video-title" style="cursor:pointer; color:#0066cc; font-weight:bold;">
            ${title}
          </span>
        `;

        // Seleção ao clicar no título
        div.querySelector(".video-title").addEventListener("click", () => {
          selectedVideo = videoId;
          selectedTitle = title;
          resultsDiv.innerHTML = `
            <div class="video selected">
              <img src="${thumbnail}" alt="thumb">
              <span>${title}</span>
            </div>
          `;
          validarCores(); // revalida para liberar o botão
        });

        resultsDiv.appendChild(div);
      });
    })
    .catch(err => {
      console.error("Erro na pesquisa YouTube:", err);
      resultsDiv.innerHTML = "Erro na pesquisa: " + err;
    })
    .finally(() => {
      searchBtn.disabled = false;
    });
}

searchBtn.addEventListener("click", buscarMusica);

// Também permite buscar apertando Enter no campo de texto
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    buscarMusica();
  }
});

// Validação das cores
function validarCores() {
  const cor1 = document.getElementById("cor1").value;
  const cor2 = document.getElementById("cor2").value;
  const cor3 = document.getElementById("cor3").value;

  if (cor1 && cor2 && cor3 && cor1 !== cor2 && cor1 !== cor3 && cor2 !== cor3 && selectedVideo) {
    submitBtn.disabled = false;
  } else {
    submitBtn.disabled = true;
  }
}

document.getElementById("cor1").addEventListener("input", validarCores);
document.getElementById("cor2").addEventListener("input", validarCores);
document.getElementById("cor3").addEventListener("input", validarCores);

// Submissão
submitBtn.addEventListener("click", () => {
  const musica = searchInput.value;
  const cor1 = document.getElementById("cor1").value;
  const cor2 = document.getElementById("cor2").value;
  const cor3 = document.getElementById("cor3").value;

  if (!selectedVideo) {
    alert("Selecione um vídeo!");
    return;
  }

  console.log("Enviando para backend:", { musica, videoId: selectedVideo, cor1, cor2, cor3 });

  // Trava o botão e avisa o usuário enquanto espera a resposta do backend
  submitBtn.disabled = true;
  submitBtn.classList.add("loading");
  confirmacao.innerText = "Aguarde...";

  // 🔄 Aqui trocamos para a URL pública do Render
  fetch("https://meu-backend-jf73.onrender.com/salvar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ musica, videoId: selectedVideo, cor1, cor2, cor3 })
  })
  .then(res => {
    console.log("Resposta bruta:", res);
    return res.json();
  })
  .then(data => {
    console.log("Resposta JSON:", data);
    confirmacao.innerText = data.mensagem;
  })
  .catch(err => {
    console.error("Erro no fetch:", err);
    confirmacao.innerText = "Erro ao salvar: " + err;
  })
  .finally(() => {
    submitBtn.classList.remove("loading");
    validarCores(); // volta o botão pro estado normal (habilitado só se ainda válido)
  });
});
