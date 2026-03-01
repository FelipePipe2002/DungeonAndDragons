package com.sistema.dnd.sistema.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_EACH_TEST_METHOD)
class DomainCrudIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void landmarkCrudSupportsEmbeddedMap() throws Exception {
        Map<String, Object> createRequest = baseLandmarkPayload("Puerto Dorado");

        MvcResult createResult = mockMvc.perform(post("/v1/landmarks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createRequest)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.nombre").value("Puerto Dorado"))
            .andExpect(jsonPath("$.mapa.kind").value("embedded"))
            .andExpect(jsonPath("$.mapa.dataUrl").value("data:image/png;base64,AAAA"))
            .andExpect(jsonPath("$.mapRotationDegrees").value(0))
            .andExpect(jsonPath("$.mapGridEnabled").value(false))
            .andExpect(jsonPath("$.mapGridCellSize").value(48.0))
            .andExpect(jsonPath("$.mapGridOffsetX").value(0.0))
            .andExpect(jsonPath("$.mapGridOffsetY").value(0.0))
            .andReturn();

        Long landmarkId = extractId(createResult);

        mockMvc.perform(get("/v1/landmarks/{id}", landmarkId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(landmarkId.intValue()))
            .andExpect(jsonPath("$.mapa.kind").value("embedded"))
            .andExpect(jsonPath("$.mapRotationDegrees").value(0))
            .andExpect(jsonPath("$.mapGridEnabled").value(false))
            .andExpect(jsonPath("$.mapGridCellSize").value(48.0))
            .andExpect(jsonPath("$.mapGridOffsetX").value(0.0))
            .andExpect(jsonPath("$.mapGridOffsetY").value(0.0))
            .andExpect(jsonPath("$.edificios").isArray())
            .andExpect(jsonPath("$.personajes").isArray())
            .andExpect(jsonPath("$.organizaciones").isArray());

        Map<String, Object> updateRequest = baseLandmarkPayload("Puerto Dorado Renovado");
        updateRequest.put("mapa", Map.of("kind", "embedded", "dataUrl", "data:image/png;base64,BBBB"));
        updateRequest.put("mapRotationDegrees", 90);
        updateRequest.put("mapGridEnabled", true);
        updateRequest.put("mapGridCellSize", 72.5);
        updateRequest.put("mapGridOffsetX", 14.25);
        updateRequest.put("mapGridOffsetY", -9.5);

        mockMvc.perform(put("/v1/landmarks/{id}", landmarkId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nombre").value("Puerto Dorado Renovado"))
            .andExpect(jsonPath("$.mapa.dataUrl").value("data:image/png;base64,BBBB"))
            .andExpect(jsonPath("$.mapRotationDegrees").value(90))
            .andExpect(jsonPath("$.mapGridEnabled").value(true))
            .andExpect(jsonPath("$.mapGridCellSize").value(72.5))
            .andExpect(jsonPath("$.mapGridOffsetX").value(14.25))
            .andExpect(jsonPath("$.mapGridOffsetY").value(-9.5));

        mockMvc.perform(delete("/v1/landmarks/{id}", landmarkId))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/landmarks/{id}", landmarkId))
            .andExpect(status().isNotFound());
    }

    @Test
    void relationshipsAreDerivedAndCascadesCleanReferences() throws Exception {
        Long landmarkId = createLandmark("Ciudadela del Alba");

        Map<String, Object> organizationPayload = new LinkedHashMap<>();
        organizationPayload.put("nombre", "Orden del Alba");
        organizationPayload.put("descripcion", "Guardianes de la ciudad");
        organizationPayload.put("tags", List.of("guardia"));
        organizationPayload.put("imagen", null);
        organizationPayload.put("categorias", List.of("militar"));
        organizationPayload.put("edificios", List.of());
        organizationPayload.put("miembros", List.of());
        organizationPayload.put("landmarks", List.of());

        Long organizationId = extractId(mockMvc.perform(post("/v1/organizations")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(organizationPayload)))
            .andExpect(status().isCreated())
            .andReturn());

        Map<String, Object> buildingPayload = new LinkedHashMap<>();
        buildingPayload.put("landmarkId", landmarkId);
        buildingPayload.put("nombre", "Forja Central");
        buildingPayload.put("posicion", List.of(0.25, 0.70));
        buildingPayload.put("descripcion", "Forja principal de la ciudad");
        buildingPayload.put("tags", List.of("metal", "herreria"));
        buildingPayload.put("duenoId", null);
        buildingPayload.put("mapBuildingIndex", 4);
        buildingPayload.put("organizationId", organizationId);

        Long buildingId = extractId(mockMvc.perform(post("/v1/buildings")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(buildingPayload)))
            .andExpect(status().isCreated())
            .andReturn());

        mockMvc.perform(get("/v1/organizations/{id}", organizationId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.edificios[0]").value(buildingId.intValue()));

        Map<String, Object> characterPayload = new LinkedHashMap<>();
        characterPayload.put("nombre", "Aldric");
        characterPayload.put("clase", "Paladin");
        characterPayload.put("raza", "Humano");
        characterPayload.put("descripcion", "Capitan de la orden");
        characterPayload.put("tags", List.of("lider", "tanque"));
        characterPayload.put("imagen", "https://img.example/aldric.png");
        characterPayload.put("landmarkId", landmarkId);
        characterPayload.put("buildingIds", List.of(buildingId));
        characterPayload.put("organizationIds", List.of(organizationId));
        characterPayload.put("eventos", List.of(
            Map.of("sesion", "Sesion 1", "descripcion", "Ingreso a la orden", "fecha", "2026-02-01")
        ));

        Long characterId = extractId(mockMvc.perform(post("/v1/characters")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(characterPayload)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.buildingIds[0]").value(buildingId.intValue()))
            .andExpect(jsonPath("$.organizationIds[0]").value(organizationId.intValue()))
            .andReturn());

        Map<String, Object> organizationUpdate = new LinkedHashMap<>();
        organizationUpdate.put("nombre", "Orden del Alba");
        organizationUpdate.put("descripcion", "Guardianes veteranos");
        organizationUpdate.put("tags", List.of("guardia", "elite", "elite"));
        organizationUpdate.put("imagen", "https://img.example/order.png");
        organizationUpdate.put("categorias", List.of("militar", "veteranos", "militar"));
        organizationUpdate.put("edificios", List.of(buildingId));
        organizationUpdate.put("miembros", List.of(Map.of("personajeId", characterId, "categoria", "Lider")));
        organizationUpdate.put("landmarks", List.of(landmarkId));

        mockMvc.perform(put("/v1/organizations/{id}", organizationId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(organizationUpdate)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.landmarks[0]").value(landmarkId.intValue()))
            .andExpect(jsonPath("$.miembros[0].personajeId").value(characterId.intValue()))
            .andExpect(jsonPath("$.miembros[0].nombre").value("Aldric"))
            .andExpect(jsonPath("$.miembros[0].profesion").value("Paladin"))
            .andExpect(jsonPath("$.miembros[0].raza").value("Humano"))
            .andExpect(jsonPath("$.miembros[0].landmarkId").value(landmarkId.intValue()))
            .andExpect(jsonPath("$.miembros[0].categoria").value("Lider"));

        mockMvc.perform(delete("/v1/characters/{id}", characterId))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/organizations/{id}", organizationId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.miembros").isEmpty());

        mockMvc.perform(delete("/v1/landmarks/{id}", landmarkId))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/v1/buildings/{id}", buildingId))
            .andExpect(status().isNotFound());

        mockMvc.perform(get("/v1/organizations/{id}", organizationId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.landmarks").isEmpty())
            .andExpect(jsonPath("$.edificios").isEmpty());
    }

    @Test
    void characterCrudPersistsPlayerFlagAndSheet() throws Exception {
        Long landmarkId = createLandmark("Refugio de Plata");

        Map<String, Object> createSheet = baseCharacterSheetPayload("Lyra", "Elf", "Wizard");
        Map<String, Object> createPayload = new LinkedHashMap<>();
        createPayload.put("nombre", "Lyra");
        createPayload.put("clase", "Wizard");
        createPayload.put("raza", "Elf");
        createPayload.put("descripcion", "Cronista arcana");
        createPayload.put("isPlayer", true);
        createPayload.put("characterSheet", createSheet);
        createPayload.put("tags", List.of("mago", "grupo"));
        createPayload.put("imagen", null);
        createPayload.put("landmarkId", landmarkId);
        createPayload.put("buildingIds", List.of());
        createPayload.put("organizationIds", List.of());
        createPayload.put("eventos", List.of());

        MvcResult createResult = mockMvc.perform(post("/v1/characters")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(createPayload)))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.nombre").value("Lyra"))
            .andExpect(jsonPath("$.isPlayer").value(true))
            .andExpect(jsonPath("$.characterSheet.name").value("Lyra"))
            .andExpect(jsonPath("$.characterSheet.race").value("Elf"))
            .andExpect(jsonPath("$.characterSheet.classes[0].name").value("Wizard"))
            .andExpect(jsonPath("$.characterSheet.ability_scores.str.score").value(10))
            .andExpect(jsonPath("$.characterSheet.ability_scores.dex.saving").value(true))
            .andExpect(jsonPath("$.characterSheet.skills['Arcana']").value(true))
            .andExpect(jsonPath("$.characterSheet.inventory[0]").value("Spellbook"))
            .andReturn();

        Long characterId = extractId(createResult);

        mockMvc.perform(get("/v1/characters/{id}", characterId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(characterId.intValue()))
            .andExpect(jsonPath("$.isPlayer").value(true))
            .andExpect(jsonPath("$.characterSheet.name").value("Lyra"))
            .andExpect(jsonPath("$.characterSheet.skills['Perception']").value(true));

        Map<String, Object> updatedSheet = baseCharacterSheetPayload("Lyra", "Elf", "Wizard");
        updatedSheet.put("background", "Guild Artisan");
        updatedSheet.put("competence_bonus", 3);
        updatedSheet.put("inventory", List.of("Spellbook", "Arcane Focus", "Journal"));
        updatedSheet.put("hit_points", Map.of("max", 14, "current", 12));

        Map<String, Object> updatePayload = new LinkedHashMap<>(createPayload);
        updatePayload.put("descripcion", "Cronista arcana veterana");
        updatePayload.put("isPlayer", false);
        updatePayload.put("characterSheet", updatedSheet);

        mockMvc.perform(put("/v1/characters/{id}", characterId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updatePayload)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.descripcion").value("Cronista arcana veterana"))
            .andExpect(jsonPath("$.isPlayer").value(false))
            .andExpect(jsonPath("$.characterSheet.background").value("Guild Artisan"))
            .andExpect(jsonPath("$.characterSheet.competence_bonus").value(3))
            .andExpect(jsonPath("$.characterSheet.hit_points.current").value(12))
            .andExpect(jsonPath("$.characterSheet.inventory[2]").value("Journal"));
    }

    @Test
    void fieldValidationErrorsReturnConsistentBadRequestPayload() throws Exception {
        Map<String, Object> invalidRequest = baseLandmarkPayload("Landmark invalido");
        invalidRequest.put("escalaIcono", 0.2);

        mockMvc.perform(post("/v1/landmarks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.error").value("Bad Request"))
            .andExpect(jsonPath("$.message").value("Error de validación"))
            .andExpect(jsonPath("$.path").value("/v1/landmarks"))
            .andExpect(jsonPath("$.errors").isArray())
            .andExpect(result -> {
                String body = result.getResponse().getContentAsString();
                if (!body.contains("escalaIcono")) {
                    throw new AssertionError("El error de validacion no incluye el campo escalaIcono: " + body);
                }
            });
    }

    @Test
    void invalidMapPayloadReturnsBadRequest() throws Exception {
        Map<String, Object> invalidMapRequest = baseLandmarkPayload("Mapa invalido");
        invalidMapRequest.put("mapa", Map.of("kind", "external", "dataUrl", "data:image/png;base64,AAAA"));

        mockMvc.perform(post("/v1/landmarks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidMapRequest)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.status").value(400))
            .andExpect(jsonPath("$.message").value("Objeto mapa invalido para kind/source"))
            .andExpect(jsonPath("$.path").value("/v1/landmarks"))
            .andExpect(jsonPath("$.error").value("Bad Request"));
    }

    private Long createLandmark(String name) throws Exception {
        Map<String, Object> request = baseLandmarkPayload(name);
        MvcResult result = mockMvc.perform(post("/v1/landmarks")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
            .andExpect(status().isCreated())
            .andReturn();
        return extractId(result);
    }

    private Long extractId(MvcResult result) throws Exception {
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return json.get("id").asLong();
    }

    private Map<String, Object> baseLandmarkPayload(String name) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("icono", "city");
        payload.put("nombre", name);
        payload.put("tipo", "ciudad");
        payload.put("escalaIcono", 1.1);
        payload.put("escalaTexto", 1.0);
        payload.put("mostrarLeyenda", true);
        payload.put("posicion", List.of(0.45, 0.55));
        payload.put("tags", List.of("capital", "puerto", "capital"));
        payload.put("poblacion", 12000);
        payload.put("descripcionCorta", "Centro comercial");
        payload.put("historia", "Fundada por marinos.");
        payload.put("eventos", List.of(
            Map.of(
                "nombre", "Fundacion",
                "descripcion", "Nacimiento de la ciudad",
                "fecha", "1200 DR",
                "posicion", List.of(0.4, 0.6)
            )
        ));
        payload.put("mapa", Map.of("kind", "embedded", "dataUrl", "data:image/png;base64,AAAA"));
        return payload;
    }

    private Map<String, Object> baseCharacterSheetPayload(String name, String race, String primaryClass) {
        Map<String, Object> payload = new LinkedHashMap<>();
        Map<String, Object> armor = new LinkedHashMap<>();
        armor.put("name", "Mage Armor");
        armor.put("ac_bonus", 3);
        armor.put("dex_bonus", true);
        armor.put("capped_dex_bonus", null);
        armor.put("stealth_disadvantage", false);

        payload.put("name", name);
        payload.put("race", race);
        payload.put("alignment", "neutral good");
        payload.put("background", "Sage");
        payload.put("competence_bonus", 2);
        payload.put("classes", List.of(Map.of(
            "name", primaryClass,
            "subtype", "Evocation",
            "level", 3,
            "hit_die", "d6"
        )));
        payload.put("speed", 30);
        payload.put("hit_points", Map.of("max", 14, "current", 9));
        payload.put("ability_scores", Map.of(
            "str", Map.of("score", 10, "saving", false),
            "dex", Map.of("score", 14, "saving", true),
            "con", Map.of("score", 12, "saving", false),
            "int", Map.of("score", 16, "saving", true),
            "wis", Map.of("score", 13, "saving", false),
            "cha", Map.of("score", 11, "saving", false)
        ));
        payload.put("skills", Map.ofEntries(
            Map.entry("Athletics", false),
            Map.entry("Acrobatics", false),
            Map.entry("Sleight of Hand", false),
            Map.entry("Stealth", false),
            Map.entry("Arcana", true),
            Map.entry("History", true),
            Map.entry("Investigation", true),
            Map.entry("Nature", true),
            Map.entry("Religion", true),
            Map.entry("Animal Handling", false),
            Map.entry("Insight", false),
            Map.entry("Medicine", false),
            Map.entry("Perception", true),
            Map.entry("Survival", false),
            Map.entry("Deception", false),
            Map.entry("Intimidation", false),
            Map.entry("Performance", false),
            Map.entry("Persuasion", false)
        ));
        payload.put("armor_class", Map.of("value", 13, "description", "Mage Armor"));
        payload.put("languages", List.of("Common", "Elvish"));
        payload.put("details", Map.of(
            "personality", "Curiosa",
            "ideal", "Conocimiento",
            "bond", "Su mentora",
            "flaw", "Obsesiva"
        ));
        payload.put("competences", List.of("Daggers", "Quarterstaffs"));
        payload.put("weapons", List.of(Map.of(
            "name", "Fire Bolt",
            "damage", "1d10",
            "damage_type", "fire",
            "properties", List.of("Ranged"),
            "mastery", false,
            "mastery_description", ""
        )));
        payload.put("armor", armor);
        payload.put("inventory", List.of("Spellbook", "Arcane Focus"));
        return payload;
    }
}
