package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.BuildingDto;
import com.sistema.dnd.sistema.dto.domain.BuildingUpsertRequest;
import com.sistema.dnd.sistema.services.BuildingService;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/v1/buildings")
public class BuildingController {

    private final BuildingService buildingService;

    public BuildingController(BuildingService buildingService) {
        this.buildingService = buildingService;
    }

    @GetMapping
    public List<BuildingDto> findAll(
        @RequestParam(required = false) Long landmarkId,
        @RequestParam(required = false) Long organizationId
    ) {
        return buildingService.findAll(landmarkId, organizationId);
    }

    @GetMapping("/{id}")
    public BuildingDto findById(@PathVariable Long id) {
        return buildingService.findById(id);
    }

    @PostMapping
    public ResponseEntity<BuildingDto> create(@Valid @RequestBody BuildingUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(buildingService.create(request));
    }

    @PutMapping("/{id}")
    public BuildingDto update(@PathVariable Long id, @Valid @RequestBody BuildingUpsertRequest request) {
        return buildingService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        buildingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
