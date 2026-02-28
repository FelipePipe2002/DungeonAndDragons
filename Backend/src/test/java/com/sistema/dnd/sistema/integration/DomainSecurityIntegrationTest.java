package com.sistema.dnd.sistema.integration;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class DomainSecurityIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void domainEndpointsWithoutAuthReturnUnauthorized() throws Exception {
        mockMvc.perform(get("/v1/landmarks"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    @WithMockUser(username = "test@example.com", roles = { "USER" })
    void domainEndpointsWithAuthWork() throws Exception {
        mockMvc.perform(get("/v1/landmarks"))
            .andExpect(status().isOk())
            .andExpect(content().json("[]"));
    }
}
