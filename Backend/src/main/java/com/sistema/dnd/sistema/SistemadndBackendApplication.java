package com.sistema.dnd.sistema;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.util.TimeZone;
	
@EnableScheduling
@SpringBootApplication
public class SistemadndBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(SistemadndBackendApplication.class, args);
	}


	@PostConstruct
	public void init(){
		// Configurar la zona horaria predeterminada a GMT-3
		TimeZone.setDefault(TimeZone.getTimeZone("America/Argentina/Buenos_Aires"));
	}

}
