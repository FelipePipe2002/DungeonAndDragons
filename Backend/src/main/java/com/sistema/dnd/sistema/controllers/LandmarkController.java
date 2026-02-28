package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.LandmarkDto;
import com.sistema.dnd.sistema.dto.domain.LandmarkUpsertRequest;
import com.sistema.dnd.sistema.services.LandmarkService;
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
@RequestMapping("/v1/landmarks")
public class LandmarkController {

    private final LandmarkService landmarkService;

    public LandmarkController(LandmarkService landmarkService) {
        this.landmarkService = landmarkService;
    }

    @GetMapping
    public List<LandmarkDto> findAll(@RequestParam(required = false) String include) {
        return landmarkService.findAll(include);
    }

    @GetMapping("/{id}")
    public LandmarkDto findById(@PathVariable Long id, @RequestParam(required = false) String include) {
        return landmarkService.findById(id, include);
    }

    @PostMapping
    public ResponseEntity<LandmarkDto> create(@Valid @RequestBody LandmarkUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(landmarkService.create(request));
    }

    @PutMapping("/{id}")
    public LandmarkDto update(@PathVariable Long id, @Valid @RequestBody LandmarkUpsertRequest request) {
        return landmarkService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        landmarkService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
