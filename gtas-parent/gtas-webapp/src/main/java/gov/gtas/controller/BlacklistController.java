/*
 * All GTAS code is Copyright 2016, The Department of Homeland Security (DHS), U.S. Customs and Border Protection (CBP).
 *
 * Please see LICENSE.txt for details.
 */
package gov.gtas.controller;

import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

/**
 * Back-end REST service interface to support audit/error log viewing and
 * configuration management.
 */
@RestController
public class BlacklistController {

	private final RestTemplate restTemplate = new RestTemplate();
	
	@Value("${TELEGRAM_TOKEN}")
	private String TELEGRAM_TOKEN = "";
	
	
	@Value("${TELEGRAM_GROUP_ID}")
	private String TELEGRAM_GROUP_ID = "";

	
	@GetMapping("/notify")
	public void notifyTelegram(@RequestParam Map<String,String> query) throws URISyntaxException {
		String baseUrl = "https://api.telegram.org/bot"+TELEGRAM_TOKEN+"/sendMessage?chat_id="+TELEGRAM_GROUP_ID+"&text="+query.get("query").replaceAll("&", "%20%20%20%20%20");
	    URI uri = new URI(baseUrl);
	 
	    ResponseEntity<Object> result = restTemplate.getForEntity(uri, Object.class);
	    System.out.println(result);
	}
}
