package com.sistema.dnd.sistema.controllers;

import com.sistema.dnd.sistema.dto.domain.MediaAssetMetadataDto;
import com.sistema.dnd.sistema.services.MediaAssetService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/v1/assets")
public class MediaAssetController {

    private final MediaAssetService mediaAssetService;

    public MediaAssetController(MediaAssetService mediaAssetService) {
        this.mediaAssetService = mediaAssetService;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<MediaAssetMetadataDto> upload(@RequestParam("file") MultipartFile file) {
        return ResponseEntity.status(HttpStatus.CREATED).body(mediaAssetService.create(file));
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        MediaAssetService.AssetDownload download = mediaAssetService.findDownload(id);
        MediaType mediaType = MediaType.parseMediaType(download.contentType());

        return ResponseEntity.ok()
            .contentType(mediaType)
            .header(
                HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.inline().filename(download.filename()).build().toString()
            )
            .body(download.body());
    }

    @GetMapping("/{id}/metadata")
    public MediaAssetMetadataDto findMetadata(@PathVariable Long id) {
        return mediaAssetService.findMetadata(id);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        mediaAssetService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
