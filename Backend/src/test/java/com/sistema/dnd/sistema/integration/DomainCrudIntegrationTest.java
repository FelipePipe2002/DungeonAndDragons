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
            .andReturn();

        Long landmarkId = extractId(createResult);

        mockMvc.perform(get("/v1/landmarks/{id}", landmarkId))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(landmarkId.intValue()))
            .andExpect(jsonPath("$.mapa.kind").value("embedded"))
            .andExpect(jsonPath("$.edificios").isArray())
            .andExpect(jsonPath("$.personajes").isArray())
            .andExpect(jsonPath("$.organizaciones").isArray());

        Map<String, Object> updateRequest = baseLandmarkPayload("Puerto Dorado Renovado");
        updateRequest.put("mapa", Map.of("kind", "embedded", "dataUrl", "data:image/png;base64,BBBB"));

        mockMvc.perform(put("/v1/landmarks/{id}", landmarkId)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.nombre").value("Puerto Dorado Renovado"))
            .andExpect(jsonPath("$.mapa.dataUrl").value("data:image/png;base64,BBBB"));

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
}
