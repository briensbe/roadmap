javascript: (function () {
  /* 1. Extraction de la clé du ticket via une Regex adaptée à Jira DataCenter */
  /* Cherche une suite de lettres majuscules, un tiret, puis des chiffres (ex: PROJ-1234) */
  const match = window.location.href.match(/([A-Z][A-Z0-9]+-\d+)/);
  const issueKey = match ? match[1] : null;

  if (!issueKey) {
    alert("Impossible de détecter une clé de ticket Jira sur cette page.");
    return;
  }

  /* 2. Appel à l'API REST de votre instance DataCenter */
  fetch(`/rest/api/2/issue/${issueKey}`)
    .then((response) => {
      if (!response.ok) throw new Error("Erreur HTTP " + response.status);
      return response.json();
    })
    .then((jiraJson) => {
      /* Gestion dynamique du custom field selon son type (String, Objet ou Tableau) */
      const rawCustomField = jiraJson.fields.customfield_11112;
      let customFieldValue = "";

      if (rawCustomField) {
        if (typeof rawCustomField === "object") {
          /* Si c'est une liste déroulante, on prend la valeur sélectionnée */
          customFieldValue = rawCustomField.value || rawCustomField.name || JSON.stringify(rawCustomField);
        } else {
          /* Si c'est du texte brut */
          customFieldValue = rawCustomField;
        }
      }

      /* 3. MAPPING DES DONNÉES */
      const monJsonSortie = {
        id: jiraJson.key,
        titre: jiraJson.fields.summary,
        description: jiraJson.fields.description || "",
        statut: jiraJson.fields.status?.name || "",
        priorite: jiraJson.fields.priority?.name || "",
        reporter: jiraJson.fields.reporter?.displayName || "Non renseigné",
        cree_le: jiraJson.fields.created,
        /* Intégration de votre clé personnalisée avec le label attendu */
        "Previa/Triskell": customFieldValue,
      };

      /* 4. Conversion en texte et copie dans le presse-papier */
      const jsonString = JSON.stringify(monJsonSortie, null, 2);

      navigator.clipboard
        .writeText(jsonString)
        .then(() => {
          /* Feedback visuel en haut à droite */
          const banner = document.createElement("div");
          banner.innerText = `✅ JSON DataCenter pour ${issueKey} copié !`;
          banner.style =
            "position:fixed;top:20px;right:20px;background:#2980b9;color:white;padding:12px 24px;border-radius:4px;z-index:99999;font-family:sans-serif;box-shadow:0 4px 6px rgba(0,0,0,0.1);";
          document.body.appendChild(banner);

          /* Supprime le bandeau après 2,5 secondes */
          setTimeout(() => banner.remove(), 2500);
        })
        .catch((err) => {
          /* Repli si le navigateur bloque l'écriture automatique */
          prompt("Copiez le JSON ci-dessous (Ctrl+C) :", jsonString);
        });
    })
    .catch((err) => {
      alert("Erreur lors de la récupération des données Jira DataCenter : " + err.message);
    });
})();
