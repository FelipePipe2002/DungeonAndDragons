package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.SubdivisionDto;
import com.sistema.dnd.sistema.dto.domain.SubdivisionUpsertRequest;
import com.sistema.dnd.sistema.services.SubdivisionService;
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
@RequestMapping("/v1/subdivisiones")
public class SubdivisionController {

    private final SubdivisionService subdivisionService;

    public SubdivisionController(SubdivisionService subdivisionService) {
        this.subdivisionService = subdivisionService;
    }

    @GetMapping
    public List<SubdivisionDto> findAll(@RequestParam(required = false) Long estadoId) {
        return subdivisionService.findAll(estadoId);
    }

    @GetMapping("/{id}")
    public SubdivisionDto findById(@PathVariable Long id) {
        return subdivisionService.findById(id);
    }

    @PostMapping
    public ResponseEntity<SubdivisionDto> create(@Valid @RequestBody SubdivisionUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(subdivisionService.create(request));
    }

    @PutMapping("/{id}")
    public SubdivisionDto update(@PathVariable Long id, @Valid @RequestBody SubdivisionUpsertRequest request) {
        return subdivisionService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        subdivisionService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
