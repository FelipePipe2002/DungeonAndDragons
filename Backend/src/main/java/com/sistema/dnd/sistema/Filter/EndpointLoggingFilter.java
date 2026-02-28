package com.sistema.dnd.sistema.Filter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;

@Slf4j
public class EndpointLoggingFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        String incomingId = request.getHeader("X-Request-Id");
        String requestId = (incomingId != null && !incomingId.isBlank()) ? incomingId : java.util.UUID.randomUUID().toString();
        String clientIp = request.getHeader("X-Forwarded-For");
        if (clientIp == null || clientIp.isBlank()) {
            clientIp = request.getRemoteAddr();
        }
        MDC.put("requestId", requestId);
        MDC.put("clientIp", clientIp);
        response.setHeader("X-Request-Id", requestId);

        long start = System.currentTimeMillis();
        try {
            log.info("Solicitud entrante: Metodo={}, URI={}, reqId={}, ip={}",
                    request.getMethod(), request.getRequestURI(), requestId, clientIp);
            filterChain.doFilter(request, response);
        } catch (Exception ex) {
            log.error("Error procesando solicitud reqId={} {} {}: {}", requestId, request.getMethod(), request.getRequestURI(), ex.toString(), ex);
            throw ex;
        } finally {
            long took = System.currentTimeMillis() - start;
            log.info("Solicitud finalizada: Metodo={}, URI={}, status={}, took={}ms, reqId={}",
                    request.getMethod(), request.getRequestURI(), response.getStatus(), took, requestId);
            MDC.clear();
        }
    }
}
