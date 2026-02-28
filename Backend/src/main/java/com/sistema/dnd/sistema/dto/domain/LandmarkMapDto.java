package com.sistema.dnd.sistema.dto.domain;

public record LandmarkMapDto(
    String kind,
    String source,
    String filename,
    String url,
    String key,
    String dataUrl
) {
}
