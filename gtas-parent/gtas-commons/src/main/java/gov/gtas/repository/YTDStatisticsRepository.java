/*
 * All GTAS code is Copyright 2016, The Department of Homeland Security (DHS), U.S. Customs and Border Protection (CBP).
 * 
 * Please see LICENSE.txt for details.
 */
package gov.gtas.repository;

import gov.gtas.model.YTDRules;
import org.springframework.data.repository.CrudRepository;

public interface YTDStatisticsRepository extends CrudRepository<YTDRules, Long> {
}
