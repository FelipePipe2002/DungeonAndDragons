package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.OrganizationDto;
import com.sistema.dnd.sistema.dto.domain.OrganizationUpsertRequest;
import com.sistema.dnd.sistema.services.OrganizationService;
import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/organizations")
public class OrganizationController {

    private final OrganizationService organizationService;

    public OrganizationController(OrganizationService organizationService) {
        this.organizationService = organizationService;
    }

    @GetMapping
    public List<OrganizationDto> findAll() {
        return organizationService.findAll();
    }

    @GetMapping("/{id}")
    public OrganizationDto findById(@PathVariable Long id) {
        return organizationService.findById(id);
    }

    @PostMapping
    public ResponseEntity<OrganizationDto> create(@Valid @RequestBody OrganizationUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(organizationService.create(request));
    }

    @PutMapping("/{id}")
    public OrganizationDto update(@PathVariable Long id, @Valid @RequestBody OrganizationUpsertRequest request) {
        return organizationService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        organizationService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
