javascript: (function () {
  /* 1. Extraction de la clé du ticket depuis l'URL (ex: PROJ-1234) */
  const pathParts = window.location.pathname.split("/");
  let issueKey = pathParts.pop();

  /* Sécurité si l'URL se termine par un slash ou des paramètres de filtre */
  if (!issueKey || issueKey.includes("?")) {
    issueKey = pathParts[pathParts.length - 1];
  }

  /* Validation de base pour s'assurer qu'on est bien sur un ticket */
  if (!issueKey || !issueKey.includes("-")) {
    alert("Impossible de détecter une clé de ticket Jira sur cette page.");
    return;
  }

  /* 2. Appel à l'API REST de Jira avec la session active du navigateur */
  fetch(`/rest/api/2/issue/${issueKey}`)
    .then((response) => {
      if (!response.ok) throw new Error("Erreur HTTP " + response.status);
      return response.json();
    })
    .then((jiraJson) => {
      /* 3. CONFIGURATION DU MAPPING (Modifiez cette structure selon vos besoins) */
      const monJsonSortie = {
        id: jiraJson.key,
        titre: jiraJson.fields.summary,
        description: jiraJson.fields.description || "",
        statut: jiraJson.fields.status?.name || "",
        priorite: jiraJson.fields.priority?.name || "",
        reporter: jiraJson.fields.reporter?.displayName || "Non renseigné",
        cree_le: jiraJson.fields.created,
      };

      /* 4. Conversion en texte et copie dans le presse-papier */
      const jsonString = JSON.stringify(monJsonSortie, null, 2);

      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          /* Petit feedback visuel en haut à droite de l'écran */
          const banner = document.createElement("div");
          banner.innerText = `✅ JSON pour ${issueKey} copié !`;
          banner.style =
            "position:fixed;top:20px;right:20px;background:#2ecc71;color:white;padding:12px 24px;border-radius:4px;z-index:99999;font-family:sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);";
          document.body.appendChild(banner);

          /* Supprime le bandeau après 2,5 secondes */
          setTimeout(() => banner.remove(), 2500);
        })
        .catch((err) => {
          /* Solution de secours si le navigateur bloque l'accès au presse-papier */
          prompt("Copiez le JSON ci-dessous (Ctrl+C) :", jsonString);
        });
    })
    .catch((err) => {
      alert("Erreur lors de la récupération des données Jira : " + err.message);
    });
})();
